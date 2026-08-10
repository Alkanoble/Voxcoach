import json
import firebase_admin
from firebase_admin import credentials, storage

cred_path = "./app/firebase-service-account.json"
try:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred, {'storageBucket': 'voxcoach-e7f00.firebasestorage.app'})

    bucket = storage.bucket()
    bucket.cors = [
        {
            "origin": ["*"],
            "responseHeader": ["*"],
            "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
            "maxAgeSeconds": 3600
        }
    ]
    bucket.patch()
    print("CORS updated successfully on voxcoach-e7f00.firebasestorage.app")
except Exception as e:
    print(f"Failed to update CORS: {e}")
