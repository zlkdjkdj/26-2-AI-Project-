from pathlib import Path
import pytest
from pydantic import ValidationError
from app.interior import InteriorPlan
from app.spatial import measured_inventory,opening_shapes,spatial_warnings
from app.layout_recommendations import recommend
from app.style_analysis import analyze
from app.electrical import cable_proposals,map_crop_box
import numpy as np

def test_measured_dimensions_openings_and_locked_recommendations():
    plan=InteriorPlan(room_width=4,room_depth=3,openings=[{'id':'door','label':'출입문','wall':'north','offset_m':0,'width_m':.9}])
    saved=plan.model_dump();saved['furniture_measurements']=[{'id':'a','width_m':1,'depth_m':.6,'fixed':True}]
    items=[{'id':'a','kind':'chair','label':'의자','width':.1,'depth':.1,'x':.13,'y':.1,'rotation':0}]
    measured_inventory(items,saved)
    assert items[0]['width']==pytest.approx(.25) and items[0]['depth']==pytest.approx(.2) and items[0]['width_source']=='measured'
    zones=opening_shapes(saved['openings'],4,3)
    assert zones[0]['width']==.225 and zones[0]['depth']==.3
    assert spatial_warnings(items,zones)
    for option in recommend({'target_type':'elderly','space_type':'living_room'},items,'minimal',zones):
        assert option['placements'][0]['x']==.13 and option['placements'][0]['y']==.1
        assert any('출입문' in warning for warning in option['warnings'])

def test_invalid_openings_partial_measurements_and_oversized_furniture():
    with pytest.raises(ValidationError):InteriorPlan(openings=[{'id':'d','label':'문','offset_m':0,'width_m':.9}])
    with pytest.raises(ValidationError):InteriorPlan(room_width=4,room_depth=3,openings=[{'id':'d','label':'문','offset_m':3.8,'width_m':.9}])
    with pytest.raises(ValidationError):InteriorPlan(room_width=4,room_depth=3,furniture_measurements=[{'id':'x','width_m':1}])
    items=[{'id':'big','kind':'bed','label':'큰 침대','width':1.5,'depth':1.5,'x':.5,'y':.5,'rotation':0}]
    options=recommend({'target_type':'elderly','space_type':'bedroom'},items,'minimal')
    assert len(options)==2 and all(option['warnings'] for option in options)

def test_style_model_runs_locally_and_abstains_on_blank():
    from PIL import Image
    import io
    blank=io.BytesIO();Image.new('RGB',(250,250),'white').save(blank,'PNG')
    assert analyze(blank.getvalue())['status']=='insufficient_detail'
    image=Path(__file__).resolve().parents[2]/'frontend/public/interior/industrial.webp'
    result=analyze(image.read_bytes())
    assert result['mode']=='local_clip' and not result['stored'] and not result['external_api']
    assert len(result['candidates'])==3 and len(result['palette'])<=5
    assert all(-1<=c['similarity']<=1 for c in result['candidates'])
    assert all(c['id']!='accessible' for c in result['candidates'])

def test_cable_crop_candidates_are_bounded_unique_and_mapped():
    scores=np.array([.15,.14,.3,.1,.9]);boxes=np.array([[.9,.8,.14,.16],[.9,.8,.14,.16],[.5,.5,.9,.9],[.2,.2,.1,.1],[.3,.3,.1,.1]])
    assert len(cable_proposals(scores,boxes,.35))==1
    assert map_crop_box([.2,.1,.4,.3],(.5,.5,1,1))==[.6,.55,.2,.15]
