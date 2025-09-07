---
layout: post
title: Building a Serverless Alerting Pipeline on GCP with Cloud RUN 
excerpt: From VM/MIG Events to Slack Notifications
date: 2025-09-07
tags: [gcloud]
mermaid: true
comments: true
---

Monitoring your infrastructure and receiving timely alerts is crucial for smooth operations. In this post, I’ll walk you through how to build a fully serverless alerting pipeline on Google Cloud Platform (GCP) that collects VM or Managed Instance Group (MIG) events, pushes them through Pub/Sub, processes them with Cloud Run, and sends notifications to Slack. All using mostly free-tier GCP services.

## Overview

The workflow consists of:

- **VM/MIG generating events** – Operations and scaling events on migs.
- **Cloud Logging** – Collects logs and exports them through a Sink to Pub/Sub.
- **Pub/Sub** – Acts as a reliable messaging bus.
- **Cloud Run** – Processes the events, runs custom logic (e.g., Python script), and forwards notifications.
- **Slack Webhook**  – Receives alerts for real-time notifications.

```mermaid
graph TD
    subgraph VM / MIG
        A1[VM / Managed Instance Group]
    end

    subgraph Logging
        B1[Cloud Logging]
        B2[Log Filtering / Log Export Sink]
        B3[Service Account - GCP logging SA]
    end

    subgraph PubSub
        C1[Pub/Sub Topic: vm-event-topic]
        C2[Subscription: vm-event-sub]
        C3[Service Account - SA with cloud run permission]
    end

    subgraph CloudRun
        D1[Cloud Run Service: vm-event-handler]
        D2[Processing Python Script: Parse Message & Call Slack]
    end

    subgraph Slack
        E1[Slack Webhook URL]
    end

    %% Flow Connections
    A1 -->|Write migs event Logs| B1
    B1 -->|Log Export| B2
    B2 -->|Sink Writer uses SA| B3
    B2 -->|Push Message| C1
    C1 --> C2
    C2 -->|Use Push SA| C3
    C2 -->|Trigger| D1
    D1 --> D2
    D2 -->|Send Notification| E1

    %% Styles
    style A1 fill:#f9f,stroke:#333,stroke-width:1px
    style B1 fill:#bbf,stroke:#333,stroke-width:1px
    style B2 fill:#bbf,stroke:#333,stroke-width:1px
    style B3 fill:#bbf,stroke:#333,stroke-width:1px
    style C1 fill:#bfb,stroke:#333,stroke-width:1px
    style C2 fill:#bfb,stroke:#333,stroke-width:1px
    style C3 fill:#bfb,stroke:#333,stroke-width:1px
    style D1 fill:#ffb,stroke:#333,stroke-width:1px
    style D2 fill:#ffb,stroke:#333,stroke-width:1px
    style E1 fill:#fbf,stroke:#333,stroke
```

## Step 1: Configure Logging Export

1. Create Pub/Sub topic

```bash
gcloud pubsub topics create mig-event-topic
```

2. Create a Log Sink in Cloud Logging:

```bash
gcloud logging sinks create mig-event-sink \
    pubsub.googleapis.com/projects/${GCP_PROJECT_ID}/topics/mig-event-topic \
    --log-filter='resource.type="gce_instance_group_manager" AND resource.labels.instance_group_manager_name="nat-gateway-mig"'
```

Ensure GCP logging Service Account(eg, service-xxxxxxx@gcp-sa-logging.iam.gserviceaccount.com) has the Pub/Sub Publisher permissions.

## Step 2: Deploy Cloud Run Service

In your working directory, you need to create the below 3 files:

1. **main.py**:

```python
import os
import json
import base64
import requests
from flask import Flask, request

app = Flask(__name__)

SLACK_WEBHOOK = os.environ.get("SLACK_WEBHOOK_URL")

@app.route("/", methods=["POST"])
def notify():
    envelope = request.get_json()
    if not envelope:
        return "No Pub/Sub message received", 400

    message = envelope.get("message", {})
    data = message.get("data")
    if data:
        decoded = base64.b64decode(data).decode("utf-8")
        try:
            payload = json.loads(decoded)
        except json.JSONDecodeError:
            payload = decoded

        # Extract the mig name from pubsub message
        mig_name = payload.get("resource", {}).get("labels", {}).get("instance_group_manager", "")

        event_type = payload.get("protoPayload", {}).get("methodName", "Unknown Event")
        text = f"MIG Event: {mig_name} | Type: {event_type}"

        requests.post(SLACK_WEBHOOK, json={"text": text})

    return "OK", 200
```

2. **Dockerfile**:

```Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY main.py .
CMD ["gunicorn", "-b", ":8080", "main:app"]
```

3. **requirements.txt**:

```txt
flask
requests
gunicorn
```

4. Create the cloud run service

```bash
gcloud run deploy mig-event-handler \
  --source . \
  --region us-central1 \
  --platform managed \
  --set-env-vars SLACK_WEBHOOK_URL="https://hooks.slack.com/services/xxxxxx/xxxxxxx"
```

## Step 3: Use subscription to push message to Cloud Run

1. First, create a SA to trigger Clour Run

```bash

gcloud iam service-accounts create pubsub-to-cloudrun \
  --display-name="Pub/Sub to Cloud Run SA"

gcloud run services add-iam-policy-binding mig-event-handler \
  --member="serviceAccount:pubsub-to-cloudrun@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.invoker" \
  --region=us-central1
```

2. Create a subscription to push message

```bash
gcloud pubsub subscriptions create mig-event-sub \
  --topic=mig-event-topic \
  --push-endpoint=https://mig-event-handler-xxxxxxxx.us-central1.run.app/ \
  --push-auth-service-account=pubsub-to-cloudrun@${GCP_PROJECT_ID}.iam.gserviceaccount.com
```

## Conclusion

This architecture allows you to implement a fully serverless, scalable, and low-cost alerting pipeline using GCP’s Logging, Pub/Sub, and Cloud Run, with real-time notifications via Slack. It’s modular and can be extended for multiple log types, more complex processing, or additional notification channels.
