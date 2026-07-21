import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification

MODEL_PATH = "model"
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH)
model.eval()

def check(text):
    enc = tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        prob = torch.softmax(model(**enc).logits, -1)[0]
    return "SCAM" if prob[1] > prob[0] else "SAFE", round(float(max(prob))*100,1)

print(check("This is CBI, you are under digital arrest, transfer money now"))
print(check("बेटा ऑफिस पहुँच गया, फ्री हो तो कॉल करना"))