import os
from dotenv import load_dotenv
from twilio.rest import Client

# Load environment variables from .env
load_dotenv()

# Fetch credentials
account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_phone = os.getenv("TWILIO_PHONE")
admin_phone = os.getenv("ADMIN_PHONE")

print("Account SID:", account_sid)
print("Auth Token:", "****" if auth_token else None)
print("Twilio Phone:", twilio_phone)
print("Admin Phone:", admin_phone)

# Test sending SMS
try:
    client = Client(account_sid, auth_token)
    message = client.messages.create(
        body="✅ Twilio test successful!",
        from_=twilio_phone,
        to=admin_phone
    )
    print("Message SID:", message.sid)
except Exception as e:
    print("❌ Twilio error:", e)
