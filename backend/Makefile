dev:
	uvicorn app.main:app --reload --port 8000

worker:
	celery -A app.workers.celery_app worker --loglevel=info --concurrency=4

beat:
	celery -A app.workers.celery_app beat --loglevel=info

flower:
	celery -A app.workers.celery_app flower --port=5555

install:
	pip install -r requirements.txt

.PHONY: dev worker beat flower install
