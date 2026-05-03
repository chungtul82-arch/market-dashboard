import base64

data = open('collector/firebase-key.json', 'rb').read()
encoded = base64.b64encode(data).decode()

with open('fb_key_b64.txt', 'w') as f:
    f.write(encoded)

print("완료! fb_key_b64.txt 파일을 열어서 내용 전체를 복사하세요.")
