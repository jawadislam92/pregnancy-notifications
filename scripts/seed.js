const db = require('../src/db');
db.list().forEach(c => db.remove(c.id));
db.create({ name:'Emma Schmidt', due_date:'2026-10-15', lang:'en', email:'emma@example.com', order_ref:'1042', source:'manual' });
db.create({ name:'Lena Müller', due_date:'2027-03-20', lang:'de', source:'manual' });
db.create({ name:'Sofia Rossi', due_date:'2027-05-02', lang:'en', email:'sofia@example.com', source:'form' });
db.create({ name:'Amelia Brontë', due_date:'2026-12-24', lang:'en', source:'form' });
console.log('seeded', db.list().length, 'customers');
