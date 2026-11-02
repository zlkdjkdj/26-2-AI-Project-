"""Detection orchestration and a bounded, private in-memory result cache.

Only model outputs are reused. Rules, target-specific advice, scores, persistence,
and explanations are rebuilt for every request. No image bytes are retained.
"""

import asyncio
import copy
import hashlib
import json
import logging
import os
import sqlite3
import time
from collections import OrderedDict
from threading import RLock
from starlette.concurrency import run_in_threadpool
from . import detection, electrical
from .config import local_path
from .db import connect

logger = logging.getLogger(__name__)
_CACHE = OrderedDict()
_LOCK = RLock()
_MAX_ENTRIES = 8
CLOCK = time.monotonic
_EXPLANATION_SLOTS = asyncio.Semaphore(2)
SETTINGS = (
    "YOLO_CONFIDENCE",
    "ELECTRICAL_DETECTION_ENABLED",
    "ELECTRICAL_BOX_THRESHOLD",
    "ELECTRICAL_CPU_THREADS",
    "ELECTRICAL_SHARED_VISION",
    "ELECTRICAL_CABLE_REFINEMENT",
    "REFERENCE_VERIFIER_ENABLED",
)


def clear_cache():
    with _LOCK:
        _CACHE.clear()


def clear_expired_cache():
    now = CLOCK()
    with _LOCK:
        for key in [key for key, value in _CACHE.items() if now >= value[0]]:
            _CACHE.pop(key)


def _file_identity(path):
    try:
        stat = path.stat()
        return str(path.resolve()), stat.st_size, stat.st_mtime_ns
    except OSError:
        return str(path), "missing"


def _key(content, object_detector, electrical_detector):
    files = [detection.model_path()]
    if electrical.enabled():
        files.extend(
            electrical.directory() / name
            for name in ("model_quantized.onnx", "tokenizer.json")
        )
    files.append(
        local_path(
            os.getenv("REFERENCE_VERIFIER_PATH", "models/reference_verifier.npz")
        )
    )
    settings = [(name, os.getenv(name)) for name in SETTINGS]
    identity = repr(
        (settings, [_file_identity(path) for path in files], electrical.QUERIES)
    )
    return (
        hashlib.sha256(content).digest(),
        hashlib.sha256(identity.encode()).digest(),
        object_detector,
        electrical_detector,
    )


async def detect(content, object_detector, electrical_detector):
    start = time.perf_counter()
    ttl = max(0, min(600, int(os.getenv("DETECTION_CACHE_SECONDS", "300"))))
    key = _key(content, object_detector, electrical_detector)
    if not ttl:
        clear_cache()
    now = CLOCK()
    if ttl:
        with _LOCK:
            for old in [k for k, v in _CACHE.items() if now >= v[0]]:
                _CACHE.pop(old)
            cached = _CACHE.get(key)
            if cached:
                _CACHE.move_to_end(key)
                return copy.deepcopy(cached[1]), {
                    "cache_hit": True,
                    "detection_seconds": round(time.perf_counter() - start, 4),
                }
    # Both branches always finish before releasing the request's compute slot.
    results = await asyncio.gather(
        run_in_threadpool(object_detector, content),
        run_in_threadpool(electrical_detector, content),
        return_exceptions=True,
    )
    for result in results:
        if isinstance(result, BaseException):
            raise result
    combined = results[0] + results[1]
    if ttl:
        with _LOCK:
            _CACHE[key] = (CLOCK() + ttl, copy.deepcopy(combined))
            while len(_CACHE) > _MAX_ENTRIES:
                _CACHE.popitem(last=False)
    return combined, {
        "cache_hit": False,
        "detection_seconds": round(time.perf_counter() - start, 4),
    }


async def finish_explanation(
    scan_id, hazards, target_type, space_type, detection_mode, explainer
):
    try:
        async with _EXPLANATION_SLOTS:
            explanation = await explainer(
                hazards, target_type, space_type, detection_mode
            )
    except Exception:
        logger.warning("Additional explanation failed; preserving rule feedback.")
        explanation = {
            "mode": "rule_template",
            "summary": "기존 위험요소별 권고사항을 확인하세요.",
            "notice": "추가 AI 설명을 완료하지 못했습니다. 위험요소별 안내와 점수는 유지됩니다.",
        }

    def save():
        with connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT result_json FROM scans WHERE id=?", (scan_id,)
            ).fetchone()
            if row is None:
                return
            stored = json.loads(row[0])
            stored.update(explanation=explanation, explanation_pending=False)
            connection.execute(
                "UPDATE scans SET result_json=? WHERE id=?",
                (json.dumps(stored, ensure_ascii=False), scan_id),
            )

    try:
        await run_in_threadpool(save)
    except sqlite3.Error:
        logger.warning("Additional explanation could not be saved.")
