require('dotenv').config();
const express = require('express');
const {v4: uuidv4} = require('uuid');
const multer = require('multer');
const path = require('path');
const {dynamo, s3} = require('./aws.helper');

const app = express();

app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.urlencoded({extended: true}));

const upload = multer({
    limits: {fileSize: 1024 * 1024},
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
        if (!allowedTypes.includes(file.mimetype)) {
            console.log('Tệp tải lên không đúng định dạng (png, jpg, jpeg). Reload lại giao diện...');
            return cb(new Error('Loại file không hợp lệ'));
        }
        cb(null, true);
    }
}).single('image');

const TABLE_NAME = process.env.DYNAMO_TABLE;
const BUCKET_NAME = process.env.S3_BUCKET_NAME;

app.get('/', async (req, res) => {
    try {
        const data = await dynamo.scan({
            TableName: TABLE_NAME
        }).promise();

        console.log('Đã lấy danh sách môn học từ DynamoDB:', data.Items.length, 'môn học');
        return res.render('index', {courses: data.Items});
    } catch (error) {
        console.error('Lỗi khi lấy danh sách môn học:', error);
        return res.status(500).send('Có lỗi xảy ra khi lấy danh sách môn học');
    }
});

app.post('/create', (req, res) => {
    upload(req, res, async function (err) {
        if (err) {
            console.log('Lỗi upload file:', err.message);
            return res.redirect('/');
        }

        try {
            const {id, name, type, semester, department} = req.body;

            let imageUrl = '';
            if (req.file) {
                const extension = path.extname(req.file.originalname) || '.jpg';
                const uniqueFileName = uuidv4() + extension;

                const uploadResult = await s3
                    .upload({
                        Bucket: BUCKET_NAME,
                        Key: uniqueFileName,
                        Body: req.file.buffer,
                        ACL: 'public-read',
                        ContentType: req.file.mimetype
                    })
                    .promise();

                imageUrl = uploadResult.Location;
                console.log('Đã upload ảnh lên S3. URL =', imageUrl);
            }

            const params = {
                TableName: TABLE_NAME,
                Item: {
                    id: id,
                    name: name,
                    type: type,
                    semester: semester,
                    department: department,
                    imageUrl: imageUrl
                }
            };

            await dynamo.put(params).promise();
            console.log('Đã lưu môn học vào DynamoDB với ID =', id, 'và Name =', name);

            return res.redirect('/');
        } catch (error) {
            console.error('Lỗi khi thêm môn học:', error);
            return res.status(500).send('Có lỗi xảy ra khi thêm môn học');
        }
    });
});

app.get('/delete/:id', async (req, res) => {
    const {id} = req.params;
    try {
        const scanResult = await dynamo.scan({
            TableName: TABLE_NAME,
            FilterExpression: '#id = :idValue',
            ExpressionAttributeNames: {
                '#id': 'id'
            },
            ExpressionAttributeValues: {
                ':idValue': id
            }
        }).promise();

        if (!scanResult.Items || scanResult.Items.length === 0) {
            console.log('Không tìm thấy môn học với ID =', id);
            return res.redirect('/');
        }

        const foundItem = scanResult.Items[0];
        const {name} = foundItem;

        await dynamo.delete({
            TableName: TABLE_NAME,
            Key: {
                id: id,
                name: name
            }
        }).promise();

        console.log(`Đã xóa môn học có ID = ${id} và Name = ${name} khỏi DynamoDB`);
        return res.redirect('/');
    } catch (error) {
        console.error('Lỗi khi xóa môn học:', error);
        return res.status(500).send('Có lỗi xảy ra khi xóa môn học');
    }
});

app.listen(3000, () => {
    console.log('Ứng dụng đang chạy trên cổng 3000...');
});
