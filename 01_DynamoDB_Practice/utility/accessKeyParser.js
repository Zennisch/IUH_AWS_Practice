const fs = require('fs');
const csv = require('csv-parser');
const filePath = './User_DynamoDB_accessKeys.csv';

const iamUsers = [];

fs.createReadStream(filePath)
.pipe(csv())
.on('data', (row) => {
    iamUsers.push(row);
})
.on('end', () => {
    console.log(iamUsers);
});

module.exports = iamUsers;
