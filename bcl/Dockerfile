FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY bcl/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the full project (bcl package + shared db layer)
COPY bcl/ /app/bcl/
COPY db/ /app/db/

# Non-root user for OCP restricted SCC
RUN useradd -u 1001 -g 0 -M -s /sbin/nologin bcl && \
    chown -R 1001:0 /app && chmod -R g=u /app
USER 1001

EXPOSE 8000

CMD ["uvicorn", "bcl.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
