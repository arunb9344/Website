const nodemailer = require('nodemailer');
const { put } = require('@vercel/blob');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const formData = new FormData();
        const contentType = event.headers['content-type'];
        const boundary = contentType.split('boundary=')[1];
        const parts = event.body.split(`--${boundary}`);

        // Parse form-data manually
        let fields = {};
        let file = null;
        for (const part of parts) {
            if (part.includes('Content-Disposition')) {
                const nameMatch = part.match(/name="([^"]+)"/);
                if (!nameMatch) continue;
                const name = nameMatch[1];
                if (part.includes('filename=')) {
                    const filenameMatch = part.match(/filename="([^"]+)"/);
                    const filename = filenameMatch ? filenameMatch[1] : 'upload';
                    const contentTypeMatch = part.match(/Content-Type: ([^\r\n]+)/);
                    const contentType = contentTypeMatch ? contentTypeMatch[1] : 'application/octet-stream';
                    const fileContent = part.split('\r\n\r\n')[1].split('\r\n--')[0];
                    file = {
                        name: filename,
                        type: contentType,
                        buffer: Buffer.from(fileContent, 'binary')
                    };
                } else {
                    const value = part.split('\r\n\r\n')[1]?.split('\r\n--')[0]?.trim();
                    fields[name] = value;
                }
            }
        }

        // Validate required fields
        const requiredFields = ['name', 'phone', 'address', 'customerType', 'issue', 'comments'];
        for (const field of requiredFields) {
            if (!fields[field]) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({ error: `Missing required field: ${field}` })
                };
            }
        }
        if (fields.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid email address' })
            };
        }
        if (!/^[0-9]{10}$/.test(fields.phone)) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Invalid phone number' })
            };
        }

        // Handle file upload
        let photoUrl = '';
        if (file) {
            const { url } = await put(`issues/${Date.now()}-${file.name}`, file.buffer, {
                access: 'public',
                token: process.env.BLOB_READ_WRITE_TOKEN
            });
            photoUrl = url;
        }

        // Configure Nodemailer with Brevo SMTP
        const transporter = nodemailer.createTransport({
            host: 'smtp-relay.brevo.com',
            port: 587,
            secure: false, // Use TLS
            auth: {
                user: process.env.BREVO_SMTP_USER,
                pass: process.env.BREVO_SMTP_KEY
            }
        });

        // Prepare email
        const mailOptions = {
            from: 'no-reply@eyetechsecurities.in', // Replace with your verified sender
            to: 'eyetechsecurities@gmail.com',
            subject: 'New Service Booking Request',
            text: `
                Name: ${fields.name}
                Phone: ${fields.phone}
                Email: ${fields.email || 'Not provided'}
                Address: ${fields.address}
                Customer Type: ${fields.customerType}
                Issue: ${fields.issue}
                Comments: ${fields.comments}
                Photo: ${photoUrl || 'Not provided'}
            `,
            html: `
                <h2>New Service Booking Request</h2>
                <p><strong>Name:</strong> ${fields.name}</p>
                <p><strong>Phone:</strong> ${fields.phone}</p>
                <p><strong>Email:</strong> ${fields.email || 'Not provided'}</p>
                <p><strong>Address:</strong> ${fields.address}</p>
                <p><strong>Customer Type:</strong> ${fields.customerType}</p>
                <p><strong>Issue:</strong> ${fields.issue}</p>
                <p><strong>Comments:</strong> ${fields.comments}</p>
                <p><strong>Photo:</strong> ${photoUrl ? `<a href="${photoUrl}">View Photo</a>` : 'Not provided'}</p>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Email sent successfully' })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal Server Error' })
        };
    }
};