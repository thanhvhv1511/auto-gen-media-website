FROM python:3.11-slim

WORKDIR /app

# Cài đặt thư viện hệ thống cần thiết cho PostgreSQL
RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

# Cài đặt thư viện Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY ./src /app/src

# Expose port
EXPOSE 8000

# Khởi chạy server FastAPI
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]