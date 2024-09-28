/**
 * Calendar Combiner and Obfuscator
 *
 * This script combines multiple iCal calendars and optionally obfuscates event details.
 * It then uploads the result to a DigitalOcean Spaces bucket.
 *
 * Functions:
 * - getCalendarUrls(): Retrieves calendar URLs from environment variables
 * - downloadCalendar(url): Downloads a calendar from a given URL
 * - combineCalendars(calendars, obfuscate): Combines multiple calendars and optionally obfuscates events
 * - uploadToSpaces(calendar, bucketName, objectKey): Uploads the combined calendar to DigitalOcean Spaces
 * - main(args): Main function that orchestrates the calendar combining process
 *
 * Environment Variables:
 * - CALENDAR_URLS: Comma-separated list of calendar URLs
 * - SPACES_KEY: DigitalOcean Spaces access key
 * - SPACES_SECRET: DigitalOcean Spaces secret key
 * - BUCKET_NAME: Name of the DigitalOcean Spaces bucket
 */

const ical = require("ical.js");
const fetch = require("node-fetch");
const moment = require("moment-timezone");
const { S3 } = require("aws-sdk");

let verbose = false; // Global verbose flag

console.log("Starting function execution");

// Initialize S3 client (DigitalOcean Spaces uses the S3 protocol)
const s3 = new S3({
  endpoint: "https://ams3.digitaloceanspaces.com",
  accessKeyId: process.env.SPACES_KEY,
  secretAccessKey: process.env.SPACES_SECRET,
});

console.log("S3 client initialized");

/**
 * Custom logging function that respects the verbose setting
 * @param {string} message - The message to log
 */
function log(message) {
  if (verbose) {
    console.log(message);
  }
}

/**
 * Retrieves calendar URLs from the CALENDAR_URLS environment variable
 * @returns {string[]} Array of calendar URLs
 */
function getCalendarUrls() {
  const urlString = process.env.CALENDAR_URLS;
  if (!urlString) {
    log("No CALENDAR_URLS found in environment variables");
    return [];
  }
  const urls = urlString.split(",").map((url) => url.trim());
  log(`Found ${urls.length} calendar URLs`);
  return urls;
}

/**
 * Downloads a calendar from a given URL
 * @param {string} url - The URL of the calendar to download
 * @returns {Promise<string>} The calendar data as a string
 */
async function downloadCalendar(url) {
  log(`Downloading calendar from ${url}`);
  const response = await fetch(url);
  const text = await response.text();
  log(`Downloaded calendar from ${url}, size: ${text.length} characters`);
  return text;
}

/**
 * Combines multiple calendars and optionally obfuscates events
 * @param {string[]} calendars - Array of calendar data strings
 * @param {boolean} obfuscate - Whether to obfuscate event details
 * @returns {ical.Component} Combined calendar
 */
function combineCalendars(calendars, obfuscate = false) {
  log(`Combining ${calendars.length} calendars, obfuscate: ${obfuscate}`);
  const combinedCalendar = new ical.Component(["vcalendar", [], []]);
  let totalEvents = 0;

  calendars.forEach((calendarData, index) => {
    log(`Processing calendar ${index + 1}`);
    const jCalData = ical.parse(calendarData);
    const calendar = new ical.Component(jCalData);
    const events = calendar.getAllSubcomponents("vevent");
    log(`Calendar ${index + 1} has ${events.length} events`);

    events.forEach((event) => {
      if (obfuscate) {
        // Create a new obfuscated event
        const obfuscatedEvent = new ical.Component("vevent");

        // Copy essential properties including RRULE for recurring events
        const essentialProps = ["dtstart", "dtend", "duration", "rrule", "uid"];
        essentialProps.forEach((propName) => {
          const prop = event.getFirstProperty(propName);
          if (prop) {
            obfuscatedEvent.addProperty(prop);
          }
        });

        // Set summary to "BUSY"
        obfuscatedEvent.updatePropertyWithValue("summary", "BUSY");

        // Use the obfuscated event instead of the original
        event = obfuscatedEvent;
      }

      const startDate = event.getFirstPropertyValue("dtstart");
      if (startDate && !startDate.zone) {
        startDate.zone = ical.Timezone.utcTimezone;
      }

      combinedCalendar.addSubcomponent(event);
      totalEvents++;
    });
  });

  log(`Combined calendar created with ${totalEvents} total events`);
  return combinedCalendar;
}

/**
 * Uploads the combined calendar to DigitalOcean Spaces
 * @param {ical.Component} calendar - The calendar to upload
 * @param {string} bucketName - The name of the Spaces bucket
 * @param {string} objectKey - The key (file name) for the uploaded calendar
 */
async function uploadToSpaces(calendar, bucketName, objectKey) {
  log(`Uploading combined calendar to ${bucketName}/${objectKey}`);
  const calendarString = calendar.toString();
  log(`Combined calendar size: ${calendarString.length} characters`);

  const params = {
    Bucket: bucketName,
    Key: objectKey,
    Body: calendarString,
    ContentType: "text/calendar",
    ACL: "public-read", // This line sets the file to be publicly readable
  };

  try {
    await s3.putObject(params).promise();
    log("Upload completed successfully");

    const publicUrl = `https://${bucketName}.ams3.digitaloceanspaces.com/${objectKey}`;
    log(`File is publicly accessible at: ${publicUrl}`);
  } catch (error) {
    console.error("Error uploading to Spaces:", error);
    throw error;
  }
}

/**
 * Main function to be executed by DigitalOcean Functions
 * @param {Object} args - Arguments passed to the function
 * @param {string} args.outputKey - The key (file name) for the output calendar
 * @param {string|boolean} args.obfuscate - Whether to obfuscate event details
 * @param {string|boolean} args.verbose - Whether to log verbose messages
 * @returns {Object} Response object with status code and body
 */
module.exports.main = async (args) => {
  const {
    outputKey,
    obfuscate: obfuscateString,
    verbose: verboseString,
  } = args;
  const obfuscate = obfuscateString === "true" || obfuscateString === true;
  verbose = verboseString === "true" || verboseString === true; // Set global verbose flag

  log("Main function started");
  log(`Args: ${JSON.stringify(args)}`);
  log(`Obfuscate setting: ${obfuscate}`);
  log(`Verbose setting: ${verbose}`);

  try {
    const bucketName = process.env.BUCKET_NAME;

    if (!bucketName) {
      throw new Error("BUCKET_NAME environment variable is not set");
    }

    log(`Using bucket: ${bucketName}`);

    log("Getting calendar URLs");
    const urls = getCalendarUrls();

    if (urls.length < 2) {
      throw new Error("At least two calendar URLs are required");
    }

    log("Downloading calendars");
    const calendars = await Promise.all(urls.map(downloadCalendar));

    log("Combining calendars");
    const combinedCalendar = combineCalendars(calendars, obfuscate);

    log("Uploading combined calendar");
    await uploadToSpaces(combinedCalendar, bucketName, outputKey);

    log("Function completed successfully");
    return {
      body: "Calendars combined and uploaded successfully",
      statusCode: 200,
    };
  } catch (error) {
    console.error("Error in main function:", error);
    return {
      body: `Error: ${error.message}`,
      statusCode: 500,
    };
  }
};
