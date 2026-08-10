import json
from google.cloud import storage
from google.oauth2 import service_account

cred_path = "c:/Users/ACER/OneDrive/Desktop/VoxCoach1fb/VoxCoach/Backend/voxcoach/app/firebase-service-account.json"
try:
    cred = service_account.Credentials.from_service_account_file(cred_path)
    client = storage.Client(credentials=cred, project="voxcoach-e7f00")
    buckets = list(client.list_buckets())
    print("Buckets:", [b.name for b in buckets])
except Exception as e:
    print(f"Error listing buckets: {e}")
