"""Real YOLOv8 ONNX inference. Mock is available only by explicit server configuration."""
import os
from pathlib import Path
from threading import RLock
import cv2
import numpy as np
from .config import BASE_DIR, local_path
from .seed import CATALOG, ROOM_OBJECTS

COCO_CLASSES = ('person bicycle car motorcycle airplane bus train truck boat traffic_light fire_hydrant stop_sign parking_meter bench bird cat dog horse sheep cow elephant bear zebra giraffe backpack umbrella handbag tie suitcase frisbee skis snowboard sports_ball kite baseball_bat baseball_glove skateboard surfboard tennis_racket bottle wine_glass cup fork knife spoon bowl banana apple sandwich orange broccoli carrot hot_dog pizza donut cake chair couch potted_plant bed dining_table toilet tv laptop mouse remote keyboard cell_phone microwave oven toaster sink refrigerator book clock vase scissors teddy_bear hair_drier toothbrush').split()
LABELS = {'person':'사람','chair':'의자','couch':'소파','bed':'침대','dining_table':'테이블','knife':'칼','scissors':'가위','backpack':'배낭','handbag':'가방','suitcase':'여행 가방','bottle':'병','wine_glass':'와인잔','cup':'컵','toilet':'변기','tv':'TV','potted_plant':'화분','sink':'싱크대','refrigerator':'냉장고','oven':'오븐','microwave':'전자레인지','laptop':'노트북','book':'책','vase':'꽃병','clock':'시계','remote':'리모컨','cell_phone':'휴대폰'}
FURNITURE = {'chair', 'couch', 'bed', 'dining_table'}
LOCK = RLock()
_NET = None
_NET_PATH = None
cv2.setNumThreads(2)

class DetectionUnavailable(Exception):
    pass

def mode():
    return os.getenv('DETECTION_MODE', 'yolo').strip().lower()

def model_path():
    return local_path(os.getenv('YOLO_MODEL_PATH', 'models/yolov8n.onnx'))

def load_model():
    global _NET, _NET_PATH
    path = model_path()
    with LOCK:
        if not path.is_file():
            raise DetectionUnavailable('실제 탐지 모델이 없습니다. 서버에서 scripts/setup_model.py를 실행하세요.')
        identity = (str(path), path.stat().st_mtime_ns)
        if _NET is None or _NET_PATH != identity:
            try:
                _NET = cv2.dnn.readNetFromONNX(str(path))
                _NET_PATH = identity
            except cv2.error as exc:
                _NET = None
                raise DetectionUnavailable('탐지 모델을 읽을 수 없습니다. 모델 파일과 서버 로그를 확인하세요.') from exc
        return _NET

def status():
    selected = mode()
    if selected == 'mock':
        return {'detection_mode':'mock', 'model_ready':True, 'model_name':'explicit-mock'}
    if selected != 'yolo':
        return {'detection_mode': selected, 'model_ready':False, 'model_name':None}
    try:
        load_model()
        return {'detection_mode':'yolo', 'model_ready':True, 'model_name':'YOLOv8n / COCO 80'}
    except DetectionUnavailable:
        return {'detection_mode':'yolo', 'model_ready':False, 'model_name':'YOLOv8n / COCO 80'}

def evidence_for(object_type: str, bbox: list[float]) -> list[str]:
    # These are 2D image observations, not claims about physical height or walkway width.
    x, y, width, height = bbox
    central_lower = .25 <= x + width / 2 <= .75 and y + height >= .65
    if object_type in ('knife', 'scissors'):
        return ['visible_sharp_object']
    if object_type in FURNITURE:
        return ['image_lower_center' if central_lower else 'visible_furniture']
    if object_type in ('backpack', 'handbag', 'suitcase') and central_lower:
        return ['image_lower_center']
    if object_type in ('oven', 'microwave', 'toaster'):
        return ['visible_appliance']
    if object_type in ('tv', 'potted_plant', 'vase'):
        return ['visible_heavy_object']
    if object_type in ('wine_glass', 'skateboard', 'sports_ball', 'umbrella'):
        return ['visible_household_object']
    return []

def decode_predictions(output, image_width, image_height, scale, pad_x, pad_y, threshold=.35):
    if output.shape != (1, 84, 8400):
        raise DetectionUnavailable('지원하지 않는 모델 출력입니다. YOLOv8n COCO ONNX 모델을 사용하세요.')
    rows = output[0].T
    classes = np.argmax(rows[:, 4:], axis=1)
    confidence = np.max(rows[:, 4:], axis=1)
    candidates = np.flatnonzero(confidence >= threshold)
    boxes, scores, class_ids = [], [], []
    for index in candidates:
        cx, cy, width, height = rows[index, :4]
        x1 = float(np.clip((cx - width / 2 - pad_x) / scale, 0, image_width))
        y1 = float(np.clip((cy - height / 2 - pad_y) / scale, 0, image_height))
        x2 = float(np.clip((cx + width / 2 - pad_x) / scale, 0, image_width))
        y2 = float(np.clip((cy + height / 2 - pad_y) / scale, 0, image_height))
        if x2 - x1 < 2 or y2 - y1 < 2:
            continue
        boxes.append([x1, y1, x2 - x1, y2 - y1])
        scores.append(float(confidence[index]))
        class_ids.append(int(classes[index]))
    selected = []
    # Class-wise NMS preserves overlapping objects of different kinds.
    for class_id in sorted(set(class_ids)):
        positions = [i for i, c in enumerate(class_ids) if c == class_id]
        keep = cv2.dnn.NMSBoxes([boxes[i] for i in positions], [scores[i] for i in positions], threshold, .45)
        selected.extend(positions[int(i)] for i in np.asarray(keep).reshape(-1))
    detections = []
    for index in sorted(selected, key=lambda i: scores[i], reverse=True)[:50]:
        object_type = COCO_CLASSES[class_ids[index]]
        x, y, width, height = boxes[index]
        bbox = [x / image_width, y / image_height, width / image_width, height / image_height]
        detections.append({'object_type':object_type, 'object_label':LABELS.get(object_type, object_type.replace('_',' ')),
                           'confidence':round(scores[index], 4), 'bbox':bbox,
                           'evidence':evidence_for(object_type, bbox), 'evidence_source':'yolo_image_geometry'})
    return detections

def detect_image(content: bytes) -> list[dict]:
    image = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise DetectionUnavailable('분석할 이미지를 읽을 수 없습니다.')
    height, width = image.shape[:2]
    scale = 640 / max(width, height)
    resized = cv2.resize(image, (round(width * scale), round(height * scale)))
    pad_x = (640 - resized.shape[1]) // 2
    pad_y = (640 - resized.shape[0]) // 2
    padded = np.full((640,640,3),114,dtype=np.uint8)
    padded[pad_y:pad_y+resized.shape[0],pad_x:pad_x+resized.shape[1]] = resized
    blob = cv2.dnn.blobFromImage(padded, 1 / 255, (640,640), swapRB=True, crop=False)
    with LOCK:
        net = load_model()
        try:
            net.setInput(blob)
            output = net.forward()
        except cv2.error as exc:
            raise DetectionUnavailable('사진 분석에 실패했습니다. 서버 로그를 확인하세요.') from exc
    return decode_predictions(output, width, height, scale, pad_x, pad_y, float(os.getenv('YOLO_CONFIDENCE', '.35')))

def infer_space(detections):
    objects = {d['object_type'] for d in detections if d['confidence'] >= .6}
    if 'toilet' in objects:
        return 'bathroom', .8
    if objects & {'refrigerator', 'oven', 'microwave'}:
        return 'kitchen', .7
    if 'bed' in objects:
        return 'bedroom', .8
    if objects & {'couch', 'tv'}:
        return 'living_room', .6
    return None, None

def detect_mock(space_type: str, scenario: str) -> list[dict]:
    objects = ROOM_OBJECTS[space_type][:4]
    conditions = {row[0]: row[1] for row in CATALOG}
    boxes = [[.09, .63, .34, .18], [.68, .32, .16, .19], [.43, .43, .23, .25], [.28, .79, .40, .15]]
    return [dict(object_type=obj, confidence=round(.94 - index * .04, 2), bbox=boxes[index], evidence=[conditions[obj]], evidence_source='mock')
            for index, obj in enumerate(objects) if scenario == 'baseline' or index == len(objects) - 1]
