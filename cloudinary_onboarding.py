#!/usr/bin/env python3
import os
import cloudinary
import cloudinary.uploader
import cloudinary.api
from dotenv import load_dotenv

load_dotenv()

# 1. Configure Cloudinary (credentials loaded from .env, not hardcoded)
cloudinary.config(
    cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
    api_key=os.environ["CLOUDINARY_API_KEY"],
    api_secret=os.environ["CLOUDINARY_API_SECRET"],
    secure=True
)

# 2. Upload a sample image from Cloudinary's demo account
upload_result = cloudinary.uploader.upload(
    "https://res.cloudinary.com/demo/image/upload/sample.jpg"
)
print("Uploaded image secure URL:", upload_result["secure_url"])
print("Uploaded image public ID:", upload_result["public_id"])

# 3. Get image details (metadata)
details = cloudinary.api.resource(upload_result["public_id"])
print("\nImage details:")
print("  Width:", details["width"])
print("  Height:", details["height"])
print("  Format:", details["format"])
print("  Bytes:", details["bytes"])

# 4. Transform the image: f_auto picks the best format for the requesting
# browser, q_auto picks the best quality/compression tradeoff automatically.
transformed_url, _ = cloudinary.utils.cloudinary_url(
    upload_result["public_id"],
    fetch_format="auto",
    quality="auto"
)
print("\nDone! Click link below to see optimized version of the image. Check the size and the format.")
print(transformed_url)
