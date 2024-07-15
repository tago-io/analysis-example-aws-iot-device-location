# AWS IoT Core Device Location Integration
Using AWS IoT Core Device Location to estimate the location of your device without using GPS.

## How to run this analysis
You should have last node version and install all dependencies running `npm install` on your terminal in this project folder.
You need to run `tagoio init` to login in your TagoIO account and set the analysis to execute.

To run locally you need to run the command `tagoio run`

or

You should run `tagoio deploy` to run this analysis on TagoIO servers.

# Sequence diagram of that integration
```mermaid
sequenceDiagram
    participant Action as TagoIO Action
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
```
