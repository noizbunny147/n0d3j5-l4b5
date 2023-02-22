// Các thư viện sử dụng ===========================================
const express = require('express');             // npm i express

// Lấy data từ request
const bodyParser = require('body-parser')       // npm i body-parser
const multer = require('multer');               // npm i multer

// Local Storage & Session Storage
const store = require("store2");                // npm i store2
// Cài đặt engine sử dụng (Ở đây xử dụng EJS)   // npm i ejs

// Thao tác với file - có sẵn trong nodejs
const fs = require('fs');

// Tạo mã ngẫu nhiên                            // npm i short-uuid
const uuid = require('short-uuid');

// Thao tác với tài khoản và một số tài khoản ====================
const { listAccount, accountValidate } = require('./handler/account.js');

// Products khi khởi tạo ứng dụng - Mapping by ID
const jsonPath = __dirname + '/json';
const products = new Map();
let text = fs.readFileSync(jsonPath + '/products.json').toString();
let productList = JSON.parse(text);
productList.forEach(p => {
    products.set(p.id, p);
})

// Khởi tạo ứng dụng express
const app = express();

// Link Express tới file ảnh
app.use(express.static(__dirname));

// Từ views lấy các file có định dạng ejs ra để render sử dụng
app.set('view engine', 'ejs');

// Cấu hình bodyParser để xử lí nội dung dạng url-encoded (e.t.c)
app.use(bodyParser.urlencoded({ extended: false }));     // Có các thông tin nhận từ url

// multer - file controller
const upload = multer({
    // File directory
    dest: 'uploads',
    // Filter: Hiện chỉ cho upload ảnh - mimetype : image/jpg, ...
    fileFilter: (req, file, callback) => {
        // Thông tin file chuẩn bị upload
        // console.log(file);

        // Cho phép upload
        if (file.mimetype.startsWith("image/")) {
            callback(null, true);
        }
        else {
            callback(null, false);
        }
    },
    // Limit : FileSize, ...
    limits: { fileSize: 500000 } // Max 500kb
});


// GET method ====================================================
app.get('/', (req, res) => {
    // Bắt buộc đăng nhập
    if (!store.has('currentUser')) {
        return res.redirect('/login');
    } else {
        res.render('index', { products: Array.from(products.values()) });
    }
})

app.get('/login', (req, res) => {
    if (store.has('currentUser')) {
        return res.redirect('/');
    } else {
        res.render('login', { email: '', password: '' });
    }
})
app.get('/logout', (req, res) => {
    if (!store.has('currentUser')) {
        return res.redirect('/login');
    } else {
        store.remove('currentUser');
        return res.redirect('/login');
    }
})

app.get('/add', (req, res) => {
    res.render('add', { name: '', price: '', desc: '', error: '' });
})
app.get('/product/:productId', (req, res) => {
    // Parameters get from GET url
    // res.send(req.params);
    let productId = req.params["productId"]

    if (!products.has(productId)) {
        return res.render('error', { title: 'Lỗi', message: 'Sản phẩm không tồn tại' });
    } else {
        return res.render('product',{product:products.get(productId)});
    }    
})
app.get('/error', (req, res) => {
    res.render('error', { title: 'Chưa có lỗi xảy ra', message: '' });
})

// POST method ====================================================
app.post('/login', (req, res) => {
    let acc = req.body;

    let result = accountValidate(acc);
    let error = result[0];
    let account = result[1];

    if (error != '') {
        res.render('login',
            {
                email: acc.email,
                password: acc.password,
                errorMessage: error
            });
    } else {
        // Save into local storage
        store('currentUser', account);
        // console.log("Đăng nhập thành công: \n", account);
        res.redirect('/');
    }

})
app.post('/add', (req, res) => {
    let uploader = upload.single('image'); // "image" thẻ có name = "image"
    uploader(req, res, err => {
        let { name, price, desc } = req.body;
        let image = req.file;

        let error = undefined;


        if (!name || name.trim().length === 0) {
            error = "Tên sản phẩm không hợp lệ";
        } else if (!price || isNaN(price) || parseInt(price) < 1) {
            error = "Giá bán không hợp lệ";
        } else if (err) {
            // Trường hợp khi gửi ảnh
            error = "Kích thước ảnh quá lớn";
        } else if (!image) {
            // res.end("File ảnh chưa có hoặc không phù hợp.");
            error = "File không hợp lệ / Thiếu ảnh";
        } else if (!desc || desc.trim().length === 0) {
            error = "Cân có mô tả sản phẩm";
        }

        // Xử lí - Thành công / Báo lỗi
        if (error === undefined) {
            // Đổi tên file
            const oldPath = image.path;
            const newPath = '/uploads/' + image.originalname;

            fs.renameSync(oldPath, newPath);

            // Lưu product vửa add để show ra màn hình
            let product = {
                id: uuid.generate(),
                name: name,
                price: price,
                desc: desc,
                image: newPath
            }

            products.set(product.id, product);

            // Lưu vào json
            let productList = Array.from(products.values())
            fs.writeFileSync(jsonPath + '/products.json', JSON.stringify(productList));

            res.redirect('/');
        } else {
            return res.render('add', { name, price, desc, error });
        }

    })

})

app.post('/delete', (req, res) => {
    let { id } = req.body;

    if (!id || id.length === 0) {
        return res.json({ code: 1, message: "Mã sản phẩm không hợp lệ" });
    }

    if (!products.has(id)) {
        return res.json({ code: 2, message: "Không tìm thấy sản phẩm " + id });
    }

    products.delete(id);
    return res.json({ code: 0, message: "Xóa sản phẩm thành công" });
})



// Others
app.use((req, res) => {
    res.set('Content-Type', 'text/html')
    res.send('Liên kết này không được hỗ trợ')
})

// Need express: npm i express
// Cannot use in VS-Terminal (process.env.PORT) - Open cmd: set PORT=...
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => { console.log(`http://localhost:${PORT}`) });