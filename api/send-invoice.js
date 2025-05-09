const express = require('express');
const SibApiV3Sdk = require('@getbrevo/brevo');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

// Initialize Brevo API client
const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY || 'YOUR_BREVO_API_KEY';

// Generate PDF Invoice for Installation Bookings
function generateInvoicePDF(booking) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const outputPath = path.join(__dirname, `invoice-${booking.invoiceNumber}.pdf`);
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Header
        doc.fontSize(20).text('EyeTech Securities', { align: 'center' });
        doc.fontSize(12).text('Invoice', { align: 'center' });
        doc.moveDown();

        // Company Details
        doc.fontSize(10).text('EyeTech Securities', { align: 'left' });
        doc.text('123 Tech Street, Software Park, Xiamen, China');
        doc.text('Email: support@eyetechsecurities.in');
        doc.text('Phone: +91-123-456-7890');
        doc.moveDown();

        // Invoice Details
        doc.fontSize(12).text(`Invoice Number: ${booking.invoiceNumber}`, { align: 'right' });
        doc.text(`Invoice Date: ${booking.invoiceDate}`, { align: 'right' });
        doc.moveDown();

        // Customer Details
        doc.fontSize(12).text('Billed To:', { align: 'left' });
        doc.fontSize(10).text(booking.customerName);
        doc.text(booking.address || 'N/A');
        doc.text(`Email: ${booking.toEmail}`);
        doc.moveDown();

        // Table Header
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Description', 50, doc.y, { width: 200 });
        doc.text('Quantity', 250, doc.y, { width: 100 });
        doc.text('Unit Price', 350, doc.y, { width: 100 });
        doc.text('Total', 450, doc.y, { width: 100 });
        doc.moveDown(0.5);

        // Table Row
        doc.font('Helvetica');
        doc.text('CCTV Installation', 50, doc.y, { width: 200 });
        doc.text(booking.numberOfCameras.toString(), 250, doc.y, { width: 100 });
        doc.text(`₹${(booking.price / booking.numberOfCameras).toFixed(2)}`, 350, doc.y, { width: 100 });
        doc.text(`₹${booking.price.toFixed(2)}`, 450, doc.y, { width: 100 });
        doc.moveDown();

        // Total
        doc.font('Helvetica-Bold');
        doc.text(`Total: ₹${booking.price.toFixed(2)}`, 450, doc.y, { width: 100 });
        doc.moveDown(2);

        // Terms & Conditions
        doc.fontSize(12).text('Terms & Conditions:', { align: 'left' });
        doc.fontSize(10).font('Helvetica');
        doc.text('1. 2 Years Manufacturer Warranty for Camera, DVR, SMPS, NVR, POE.');
        doc.text('2. 3 Years Manufacturer Warranty for Hard Disk above 1TB. For 500GB, 2 Years Manufacturer Warranty.');
        doc.text('3. 1 Year Free Service for CCTV Camera.');
        doc.moveDown();

        // Additional Info
        doc.text(`DVR/NVR Serial Number: ${booking.serialNumber || 'N/A'}`);
        doc.moveDown();

        // Footer
        doc.fontSize(8).text('Thank you for choosing EyeTech Securities!', { align: 'center' });

        doc.end();

        stream.on('finish', () => {
            const pdfBuffer = fs.readFileSync(outputPath);
            resolve(pdfBuffer);
        });

        stream.on('error', (err) => {
            reject(err);
        });
    });
}

// Send Service Invoice Email (Plain Text)
app.post('/api/send-invoice', async (req, res) => {
    const { toEmail, customerName, invoiceNumber, invoiceDate, amount, issue, solution } = req.body;

    if (!toEmail || !customerName || !invoiceNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendSmtpEmail.sender = { email: 'no-reply@eyetechsecurities.in', name: 'EyeTech Securities' };
    sendSmtpEmail.to = [{ email: toEmail }];
    sendSmtpEmail.subject = `Service Invoice ${invoiceNumber}`;
    sendSmtpEmail.htmlContent = `
        <p>Dear ${customerName},</p>
        <p>Thank you for choosing EyeTech Securities. Below are the details of your service invoice:</p>
        <ul>
            <li><strong>Invoice Number:</strong> ${invoiceNumber}</li>
            <li><strong>Invoice Date:</strong> ${invoiceDate}</li>
            <li><strong>Amount:</strong> ₹${amount || '0.00'}</li>
            <li><strong>Issue:</strong> ${issue || 'N/A'}</li>
            <li><strong>Solution:</strong> ${solution || 'N/A'}</li>
        </ul>
        <p>Please contact us at support@eyetechsecurities.in for any queries.</p>
        <p>Best regards,<br>EyeTech Securities Team</p>
    `;

    try {
        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`Service invoice email sent to ${toEmail}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending service invoice email:', error);
        res.status(500).json({ error: 'Failed to send service invoice email' });
    }
});

// Send Installation Invoice Email (PDF Attachment)
app.post('/api/send-installation-invoice', async (req, res) => {
    const { toEmail, customerName, invoiceNumber, invoiceDate, numberOfCameras, price, serialNumber, address } = req.body;

    if (!toEmail || !customerName || !invoiceNumber || !numberOfCameras || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Generate PDF
        const pdfBuffer = await generateInvoicePDF({
            toEmail,
            customerName,
            invoiceNumber,
            invoiceDate,
            numberOfCameras,
            price,
            serialNumber,
            address
        });

        // Encode PDF to Base64
        const pdfBase64 = pdfBuffer.toString('base64');

        // Send Email with PDF Attachment
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendSmtpEmail.sender = { email: 'no-reply@eyetechsecurities.in', name: 'EyeTech Securities' };
        sendSmtpEmail.to = [{ email: toEmail }];
        sendSmtpEmail.subject = `Installation Invoice ${invoiceNumber}`;
        sendSmtpEmail.htmlContent = `
            <p>Dear ${customerName},</p>
            <p>Thank you for choosing EyeTech Securities. Please find your installation invoice attached.</p>
            <p>Invoice Details:</p>
            <ul>
                <li><strong>Invoice Number:</strong> ${invoiceNumber}</li>
                <li><strong>Invoice Date:</strong> ${invoiceDate}</li>
                <li><strong>Number of Cameras:</strong> ${numberOfCameras}</li>
                <li><strong>Total Amount:</strong> ₹${price.toFixed(2)}</li>
            </ul>
            <p>Please contact us at support@eyetechsecurities.in for any queries.</p>
            <p>Best regards,<br>EyeTech Securities Team</p>
        `;
        sendSmtpEmail.attachment = [{
            content: pdfBase64,
            name: `invoice-${invoiceNumber}.pdf`
        }];

        await apiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`Installation invoice email with PDF sent to ${toEmail}`);

        // Clean up PDF file
        fs.unlinkSync(path.join(__dirname, `invoice-${invoiceNumber}.pdf`));

        res.json({ success: true });
    } catch (error) {
        console.error('Error sending installation invoice email:', error);
        res.status(500).json({ error: 'Failed to send installation invoice email' });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});