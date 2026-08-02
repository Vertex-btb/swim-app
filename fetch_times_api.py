import urllib.request
import json
import base64
import time

def generate_device_id():
    now_ms = int(time.time() * 1000)
    raw_str = f"platform - vendor - unknown - {now_ms}"
    b64_bytes = base64.b64encode(raw_str.encode('utf-8'))
    b64_str = b64_bytes.decode('utf-8')
    device_id = b64_str[:15] + b64_str[:5] + b64_str[15:]
    return device_id

def main():
    # Colin's 100 Free SCY Swim Time ID: 223177149
    swim_time_id = "223177149"
    url = f"https://times-api.usaswimming.org/swims/TimesSearch/AllTimes/SwimTime/{swim_time_id}?isUsaSwimming=1"
    
    device_id = generate_device_id()
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Device-Id': device_id,
        'AppName': 'DataHub',
        'Usas-Sub-Id': 'Anonymous',
        'Referer': 'https://dhy-prod.usaswimming.org/',
        'Origin': 'https://dhy-prod.usaswimming.org',
        'Accept': 'application/json, text/plain, */*'
    }
    
    req = urllib.request.Request(url, headers=headers)
    try:
        response = urllib.request.urlopen(req).read().decode('utf-8')
        data = json.loads(response)
        print("SUCCESS!")
        print(json.dumps(data, indent=2))
            
    except Exception as e:
        print("Failed to fetch API:", e)

if __name__ == "__main__":
    main()
