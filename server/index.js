const express = require("express");
const {
  S3Client,
  GetObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const sharp = require("sharp");
const app = express();
const port = 3000;

const s3 = new S3Client({ region: "eu-north-1" });

const bucketName = "markus-photos";

const originalPrefix = "original/";
const thumbnailPrefix = "thumbnail/";

const cacheEnabled = true;

const supportedImageFormats = [".jpg", ".jpeg", ".png", ".webp"];

// Serve static files from the public directory
app.use(express.static("public"));

app.get("/api", async (req, res) => {
  // List all objects in the bucket
  const params = {
    Bucket: bucketName,
    Prefix: originalPrefix,
  };
  const command = new ListObjectsV2Command(params);

  let response = await s3.send(command);
  let keys = s3ResponseToKeyArray(response);

  // Filter out non-image files (not case sensitive)
  keys = keys.filter((key) =>
    supportedImageFormats.some((format) => key.toLowerCase().endsWith(format))
  );

  // Randomize the order of the keys
  keys.sort(() => Math.random() - 0.5);

  // Limit the number of keys to 50
  keys = keys.slice(0, 100);

  res.json(keys);
});

app.get("/photo/original/:key", async (req, res) => {
  const key = req.params.key;

  const params = {
    Bucket: bucketName,
    Key: originalPrefix + key,
  };
  // Check if the object exists
  try {
    await s3.send(new HeadObjectCommand(params));
  } catch (error) {
    res.status(404).send("File not found");
    return;
  }

  try {
    // Get the object
    const command = new GetObjectCommand(params);
    const response = await s3.send(command);

    // Set the correct content type
    res.set("Content-Type", response.ContentType);

    // Stream the file
    response.Body.pipe(res);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

app.get("/photo/thumbnail/:key", async (req, res) => {
  const key = req.params.key;

  const params = {
    Bucket: bucketName,
    Key: thumbnailPrefix + key,
  };

  // Adds caching headers
  res.set("Cache-Control", "public, max-age=31536000");

  // Check if the object exists and compress it if it does not
  try {
    if (!cacheEnabled) throw new Error("Cache disabled");
    await s3.send(new HeadObjectCommand(params));
  } catch (error) {
    console.log("Compressing image");

    // Compress the image
    const originalParams = {
      Bucket: bucketName,
      Key: originalPrefix + key,
    };
    const originalResponse = await s3.send(
      new GetObjectCommand(originalParams)
    );

    const stream = originalResponse.Body;

    try {
      let transform = sharp();

      transform = transform.resize(200, 200);
      transform = transform.webp();

      stream.pipe(transform);

      const buffer = await transform.toBuffer();
      // Upload the compressed image to S3
      const uploadParams = {
        Bucket: bucketName,
        Key: thumbnailPrefix + key,
        Body: buffer,
        ContentType: "image/webp",
      };

      if (cacheEnabled) {
        await s3.send(new PutObjectCommand(uploadParams));
      }

      // Set the correct content type
      res.set("Content-Type", "image/webp");

      // Stream
      res.send(buffer);
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }

    return;
  }

  // Get the object
  const command = new GetObjectCommand(params);
  const response = await s3.send(command);

  // Set the correct content type
  res.set("Content-Type", response.ContentType);

  // Stream the file
  response.Body.pipe(res);
});

function s3ResponseToKeyArray(response) {
  let data = response.Contents.map((object) => object.Key);

  // Remove the prefix from the keys
  let keys = data.map((key) => key.replace(originalPrefix, ""));

  // Is key is empty, remove it
  keys = keys.filter((key) => key !== "");

  return keys;
}

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
