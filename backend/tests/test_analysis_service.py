import asyncio
import threading
import pytest
from app import analysis_service as service


@pytest.fixture(autouse=True)
def empty_cache(monkeypatch):
    service.clear_cache()
    monkeypatch.setenv("DETECTION_CACHE_SECONDS", "300")
    yield
    service.clear_cache()


def test_parallel_detection_reuse_is_complete_and_caller_mutation_cannot_poison_it():
    barrier = threading.Barrier(2)
    calls = []

    def objects(content):
        calls.append("objects")
        barrier.wait(timeout=3)
        return [
            {
                "object_type": "chair",
                "bbox": [0.1, 0.2, 0.3, 0.4],
                "evidence": ["visible_furniture"],
            }
        ]

    def electrical(content):
        calls.append("electrical")
        barrier.wait(timeout=3)
        return [{"object_type": "electric_wire", "bbox": [0.2, 0.3, 0.4, 0.5]}]

    result, first = asyncio.run(
        service.detect(b"normalized-image", objects, electrical)
    )
    assert first["cache_hit"] is False and len(result) == 2
    result[0]["bbox"][0] = 99
    result.append({"poison": True})
    again, second = asyncio.run(
        service.detect(b"normalized-image", objects, electrical)
    )
    assert (
        second["cache_hit"] is True and len(again) == 2 and again[0]["bbox"][0] == 0.1
    )
    assert calls.count("objects") == calls.count("electrical") == 1


def test_changed_image_threshold_or_model_invalidates_detection_cache(
    monkeypatch, tmp_path
):
    path = tmp_path / "model.onnx"
    path.write_bytes(b"old")
    monkeypatch.setattr(service.detection, "model_path", lambda: path)
    calls = []

    def detector(content):
        calls.append(content)
        return []

    def other(content):
        return []

    async def run(image=b"image"):
        return await service.detect(image, detector, other)

    assert asyncio.run(run())[1]["cache_hit"] is False
    assert asyncio.run(run())[1]["cache_hit"] is True
    assert asyncio.run(run(b"new-image"))[1]["cache_hit"] is False
    monkeypatch.setenv("YOLO_CONFIDENCE", ".44")
    assert asyncio.run(run())[1]["cache_hit"] is False
    path.write_bytes(b"changed-model")
    assert asyncio.run(run())[1]["cache_hit"] is False
    assert len(calls) == 4


def test_expiration_disabling_and_capacity(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr(service, "CLOCK", lambda: clock[0])
    monkeypatch.setenv("DETECTION_CACHE_SECONDS", "1")

    def detector(content):
        return []

    def other(content):
        return []

    asyncio.run(service.detect(b"image", detector, other))
    clock[0] = 102
    service.clear_expired_cache()
    assert len(service._CACHE) == 0
    for number in range(10):
        asyncio.run(service.detect(str(number).encode(), detector, other))
    assert len(service._CACHE) == 8
    assert asyncio.run(service.detect(b"0", detector, other))[1]["cache_hit"] is False
    monkeypatch.setenv("DETECTION_CACHE_SECONDS", "0")
    assert asyncio.run(service.detect(b"0", detector, other))[1]["cache_hit"] is False
    assert len(service._CACHE) == 0


def test_failed_detection_never_becomes_a_successful_cached_result():
    def fails(content):
        raise RuntimeError("model unavailable")

    def other(content):
        return []

    for _ in range(2):
        with pytest.raises(RuntimeError):
            asyncio.run(service.detect(b"image", fails, other))
    assert not service._CACHE
