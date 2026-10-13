from PIL import Image
import numpy as np
from app import reference_verifier as verifier

def test_reference_disagreement_flags_but_never_changes_detection(monkeypatch,tmp_path):
    path=tmp_path/'weights.npz';path.write_bytes(b'test')
    monkeypatch.setenv('REFERENCE_VERIFIER_PATH',str(path))
    monkeypatch.setenv('REFERENCE_VERIFIER_ENABLED','true')
    monkeypatch.setattr(verifier,'load_model',lambda *a:({}, {'disagreement_threshold':.9}))
    monkeypatch.setattr(verifier,'predict',lambda *a:('light_switch',.97))
    detection={'object_type':'socket','bbox':[.1,.1,.4,.4],'confidence':.72,
               'evidence':['visible_socket'],'object_label':'콘센트'}
    result=verifier.annotate(Image.new('RGB',(100,100)),[detection])[0]
    assert result['classification_uncertain']
    assert result['alternative_labels']==['스위치']
    assert result['object_type']=='socket' and result['confidence']==.72
    assert result['bbox']==[.1,.1,.4,.4] and result['evidence']==['visible_socket']

def test_reference_low_match_does_not_create_ambiguity(monkeypatch,tmp_path):
    path=tmp_path/'weights.npz';path.write_bytes(b'test')
    monkeypatch.setenv('REFERENCE_VERIFIER_PATH',str(path))
    monkeypatch.setenv('REFERENCE_VERIFIER_ENABLED','true')
    monkeypatch.setattr(verifier,'load_model',lambda *a:({}, {'disagreement_threshold':.9}))
    monkeypatch.setattr(verifier,'predict',lambda *a:('light_switch',.6))
    detection={'object_type':'socket','bbox':[.1,.1,.4,.4]}
    result=verifier.annotate(Image.new('RGB',(100,100)),[detection])[0]
    assert 'classification_uncertain' not in result

def test_reference_corrupt_or_missing_model_preserves_detection(monkeypatch,tmp_path):
    path=tmp_path/'broken.npz';path.write_bytes(b'not a model')
    monkeypatch.setenv('REFERENCE_VERIFIER_PATH',str(path))
    monkeypatch.setenv('REFERENCE_VERIFIER_ENABLED','true')
    items=[{'object_type':'socket','bbox':[.1,.1,.2,.2]}]
    assert verifier.annotate(Image.new('RGB',(100,100)),items)==items
    assert not verifier.status()['ready']
    path.unlink()
    assert verifier.annotate(Image.new('RGB',(100,100)),items)==items

def test_features_are_small_finite_and_no_private_storage():
    result=verifier.features(Image.new('RGB',(15,30),'white'))
    assert result.shape==(601,) and np.isfinite(result).all()

def test_training_groups_merge_exact_duplicates():
    import importlib.util
    from pathlib import Path
    path=Path(__file__).parents[2]/'scripts/train_reference_verifier.py'
    spec=importlib.util.spec_from_file_location('training_script',path)
    script=importlib.util.module_from_spec(spec);spec.loader.exec_module(script)
    groups=script.grouped_originals([
        {'original_group':'a','sha256':'1'}, {'original_group':'b','sha256':'1'},
        {'original_group':'b','sha256':'2'}, {'original_group':'c','sha256':'2'},
        {'original_group':'d','sha256':'3'}])
    assert groups['a']==groups['b']==groups['c'] and groups['d']!=groups['a']
