from flask import Flask, request, jsonify
import joblib
import pandas as pd

app = Flask(__name__)

# Load model and preprocessor
model = joblib.load("readmission_model.pkl")
preprocessor = joblib.load("preprocessor.pkl")

@app.route('/predict', methods=['POST'])
def predict():
    # Expect JSON input from backend/frontend
    data = request.get_json()

    # Build dataframe with correct column names
    input_data = pd.DataFrame([{
        'age': data['age'],
        'time_in_hospital': data['time_in_hospital'],
        'n_lab_procedures': data['n_lab_procedures'],
        'n_procedures': data['n_procedures'],
        'n_medications': data['n_medications'],
        'n_outpatient': data['n_outpatient'],
        'n_emergency': data['n_emergency'],
        'n_inpatient': data['n_inpatient'],
        'diag_1': data['diag_1'],
        'diag_2': data['diag_2'],
        'diag_3': data['diag_3'],
        'medical_specialty': data['medical_specialty'],
        'glucose_test': data['glucose_test'],
        'A1Ctest': data['A1Ctest'],   # ✅ exact spelling
        'diabetes_med': data['diabetes_med'],
        'change': data['change']
    }])

    # Transform and predict
    processed = preprocessor.transform(input_data)
    prediction = model.predict(processed)

    # Return JSON response
    return jsonify({'prediction': int(prediction[0])})

if __name__ == '__main__':
    app.run(debug=True)

python3 --version
streamlit hello
docker run hello-world
