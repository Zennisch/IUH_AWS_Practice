require("dotenv").config();
const express = require("express");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const path = require("path");
const { dynamodb, s3 } = require("./aws.helper");

const app = express();

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.urlencoded({ extended: true }));

const TABLE_NAME = process.env.DYNAMODB_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

const upload = multer({
    limits: { fieldSize: 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ["images/jpeg", "image/png", "image/jpg"];
        if (!allowedTypes.includes(file.mimetype)) {
            console.log("Wrong file type");
            return cb(new Error("Wrong file type"));
        }
        cb(null, true);
    },
}).single("image");

app.get("/", async (req, res) => {
    try {
        const data = await dynamodb
            .scan({
                TableName: TABLE_NAME,
            })
            .promise();
        console.log(`Data Length: ${data.Items.length}`);
        return res.render("index", { papers: data.Items });
    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal Server Error");
    }
});

app.get("/add", async (req, res) => {
    return res.render("add");
});

app.post("/add", async (req, res) => {
    upload(req, res, async (err) => {
        if (err) {
            console.log(`Error uploading file: ${err.message}`);
            return res.redirect("/");
        }
        try {
            const { name, type, price } = req.body;
            id = uuidv4();
            if (req.file) {
                const ext = path.extname(req.file.originalname);
                const uniqueName = `${id}${ext}`;

                const result = await s3
                    .upload({
                        Bucket: BUCKET_NAME,
                        Key: uniqueName,
                        Body: req.file.buffer,
                        ACL: "public-read",
                        ContentType: req.file.mimetype,
                    })
                    .promise();
                imageURL = result.Location;
                console.log(`Uploaded image to S3: ${imageURL}`);
            }
            await dynamodb
                .put({
                    TableName: TABLE_NAME,
                    Item: {
                        id: id,
                        name: name,
                        type: type,
                        price: price,
                        image: imageURL,
                    },
                })
                .promise();

            console.log(`Created item with id: ${id}`);
            return res.redirect("/");
        } catch (error) {
            console.log(error);
            return res.status(500).send("Internal Server");
        }
    });
});

app.get("/delete/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const scanResult = await dynamodb
            .scan({
                TableName: TABLE_NAME,
                FilterExpression: "#id = :idValue",
                ExpressionAttributeNames: {
                    "#id": "id",
                },
                ExpressionAttributeValues: {
                    ":idValue": id,
                },
            })
            .promise();

        if (scanResult.Items.length === 0 || !scanResult.Items) {
            return res.status(404).send("Paper not found");
        }
        const item = scanResult.Items[0];
        const { name } = item;

        await dynamodb
            .delete({
                TableName: TABLE_NAME,
                Key: {
                    id: id,
                    name: name,
                },
            })
            .promise();
        console.log(`Deleted item with id: ${id}`);
        return res.redirect("/");
    } catch (error) {
        console.error(error);
        return res.status(500).send("Internal server error");
    }
});

app.listen(3000, () => {
    console.log("Server is running on port 3000");
});
