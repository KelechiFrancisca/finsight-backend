import joblib

# Load the saved model
model = joblib.load("readmission_model.pkl")

# Example: make a prediction with 49 features
# Replace these with real patient data values
sample_data = [[0]*49]  # a row of 49 zeros just as a placeholder
prediction = model.predict(sample_data)

print("Prediction:", prediction)
