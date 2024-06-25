# AWS IoT Core Device Location Integration

sequenceDiagram
    participant Action as Action
    participant Analysis as TagoIO Analysis
    participant Device as TagoIO Device
    participant AWS as AWS

    Action ->> Analysis: Trigger Action execute the Analysis
    Analysis ->> Device: Get Device to Estimate Position
    Device ->> Analysis: Return Device
    Analysis ->> Device: Get Last Data Input from Device Bucket
    Device ->> Analysis: Return Last Data Input
    Analysis ->> AWS: Get Estimated Position from AWS
    AWS ->> Analysis: Return Estimated Position with Accuracy
    Analysis ->> Analysis: Validate Accuracy
    alt Accuracy Valid
        Analysis ->> Device: Register Data on Device Bucket
    else Accuracy Invalid
        Analysis ->> Device: Register Data on Device Bucket Error
    end