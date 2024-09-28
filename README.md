# Calendar Combiner and Obfuscator

This project is a DigitalOcean Function that combines multiple iCal calendars, optionally obfuscates event details, and uploads the result to a DigitalOcean Spaces bucket.

## Features

- Combines multiple iCal calendars into a single calendar
- Optional obfuscation of event details (replaces event information with "BUSY")
- Uploads the combined calendar to a DigitalOcean Spaces bucket
- Configurable verbosity for logging

## Prerequisites

- DigitalOcean account with Functions and Spaces enabled
- Node.js and npm installed locally for development
- DigitalOcean CLI (doctl) installed and configured

## Setup

1. Clone this repository:
   ```
   git clone https://github.com/diegomarino/calendar-combiner.git
   cd calendar-combiner
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up your DigitalOcean Spaces:
   - Create a new Spaces bucket or use an existing one
   - Note down the bucket name and region

4. Configure environment variables:
   Set the following environment variables in your DigitalOcean Function:
   - `CALENDAR_URLS`: Comma-separated list of calendar URLs to combine
   - `SPACES_KEY`: Your DigitalOcean Spaces access key
   - `SPACES_SECRET`: Your DigitalOcean Spaces secret key
   - `BUCKET_NAME`: Name of your DigitalOcean Spaces bucket

## Deployment

1. Make sure you're logged in to DigitalOcean CLI:
   ```
   doctl auth init
   ```

2. Deploy the function:
   ```
   doctl serverless deploy .
   ```

## Usage

Invoke the function using the DigitalOcean CLI:

```
doctl serverless functions invoke calendar/combine --param-file .payload
```

## License

This project is licensed under the MIT License.
