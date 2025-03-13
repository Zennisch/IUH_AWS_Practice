const express = require('express');
const app = express();
const port = 3000;
const data = require('./datas/data.js');

app.use(express.json({ extended: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static('.views'));
app.set('view engine', 'ejs');
app.set('views', './views');

app.get('/', (req, res) => {
    return res.render('index', { data: data });
});

app.post('/create', (req, res) => {
    const { stt, tenMonHoc, chuyenNganh, soTinChi, khoa } = req.body;
    const params = { stt, tenMonHoc, chuyenNganh, soTinChi, khoa };
    data.push(params);
    return res.render('index', { data: data });
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
