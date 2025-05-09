const Brevo = require('@getbrevo/brevo');
const PDFDocument = require('pdfkit');
const { Buffer } = require('buffer');

// Helper function to generate professional PDF invoice for installation
const generatePDF = (booking) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const buffers = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers).toString('base64');
        resolve(pdfData);
      });
      doc.on('error', (err) => reject(err));

      // Header: EyeTech Securities Branding
      doc
        .fontSize(24)
        .font('Helvetica-Bold')
        .fillColor('#003087') // Professional blue
        .text('EyeTech Securities', 50, 40)
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text('No.56/80, 1st Floor, Medavakkam Main Road', 50, 70)
        .text('Chennai, Tamil Nadu 600117, India', 50, 85)
        .text('Phone: +91-9962835944', 50, 100)
        .text('Email: eyetechsecurities@gmail.com', 50, 115);

      // Right-aligned Invoice Info
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('INVOICE', 400, 40, { align: 'right' })
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice Number: ${booking.invoiceNumber}`, 400, 60, { align: 'right' })
        .text(`Invoice Date: ${booking.invoiceDate}`, 400, 75, { align: 'right' });

      // Divider Line
      doc
        .moveTo(50, 150)
        .lineTo(550, 150)
        .strokeColor('#003087')
        .lineWidth(1)
        .stroke();

      // Customer Details (Bill To)
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Bill To:', 50, 170)
        .fontSize(10)
        .font('Helvetica')
        .text(booking.customerName, 50, 190)
        .text(booking.address, 50, 205, { width: 250 })
        .text(`Phone: ${booking.phone || 'N/A'}`, 50, 235) // Added phone number
        .text(`Email: ${booking.toEmail}`, 50, 250);

      // Table Header
      const tableTop = 280;
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .fillColor('#ffffff')
        .rect(50, tableTop, 500, 20)
        .fill('#003087')
        .text('Description', 55, tableTop + 6)
        .text('Quantity', 350, tableTop + 6)
        .text('Amount (INR)', 450, tableTop + 6, { align: 'right' });

      // Table Row
      const rowTop = tableTop + 20;
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .rect(50, rowTop, 500, 20)
        .fill('#f5f5f5')
        .text(`CCTV Installation - ${booking.installationType}`, 55, rowTop + 6)
        .text(`${booking.numCameras}`, 350, rowTop + 6)
        .text(`${booking.price.toFixed(2)}`, 450, rowTop + 6, { align: 'right' });

      // Installation Details
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Installation Details:', 50, rowTop + 40)
        .fontSize(10)
        .font('Helvetica')
        .text(`Number of Cameras: ${booking.numCameras}`, 50, rowTop + 60) // Added Number of Cameras
        .text(`Serial Number: ${booking.serialNumber}`, 50, rowTop + 75)
        .text(`Comments: ${booking.comments || 'None'}`, 50, rowTop + 90, { width: 500 });

      // Total
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text(`Total: INR ${booking.price.toFixed(2)}`, 450, rowTop + 130, { align: 'right' });

      // Terms & Conditions
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .fillColor('#333333')
        .text('Terms & Conditions:', 50, rowTop + 160)
        .fontSize(10)
        .font('Helvetica')
        .text('• 2 Years Manufacturing Warranty for Camera, DVR, SMPS, POE, NVR.', 50, rowTop + 180)
        .text('• 3 Years Manufacturing Warranty for Hard Disk above 1TB. 2 Years Manufacturing Warranty for 500GB Hard Disk.', 50, rowTop + 195)
        .text('• 1 Year Free Service for CCTV Camera System.', 50, rowTop + 210);

      // System-Generated Note
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text('This is System Generated Invoice, Hence no Signature is Required', 50, rowTop + 240, { align: 'center' });

      // Footer
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text('Thank you for choosing EyeTech Securities!', 50, doc.page.height - 100, { align: 'center' })
        .text('For queries, contact us at eyetechsecurities@gmail.com or +91-9962835944', 50, doc.page.height - 85, { align: 'center' })
        .text('Terms: Payment due within 30 days. Late payments may incur additional charges.', 50, doc.page.height - 70, { align: 'center' })
        .text('Regards, Eye Tech Securities', 50, doc.page.height - 55, { align: 'center' }); // Added Regards

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

// Vercel serverless function
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail, customerName, invoiceNumber, invoiceDate, numCameras, price, serialNumber, address, installationType, preferredDate, comments, phone } = req.body;

  // Validate request body
  if (!toEmail || !customerName || !invoiceNumber || !invoiceDate || !numCameras || !price || !serialNumber || !address || !installationType) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Generate PDF
    const pdfBase64 = await generatePDF({
      toEmail,
      customerName,
      invoiceNumber,
      invoiceDate,
      numCameras: parseInt(numCameras),
      price: parseFloat(price),
      serialNumber,
      address,
      installationType,
      comments,
      phone
    });

    // Initialize Brevo client
    const apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    // Configure email with template ID
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'EyeTech Securities', email: 'no-reply@eyetechsecurities.in' };
    sendSmtpEmail.to = [{ email: toEmail }];
    sendSmtpEmail.subject = `Your Installation Invoice ${invoiceNumber} from EyeTech Securities`;
    sendSmtpEmail.templateId = parseInt(process.env.BREVO_INSTALLATION_TEMPLATE_ID); // Template ID 2
    sendSmtpEmail.params = {
      customerName,
      invoiceNumber,
      invoiceDate,
      numCameras: parseInt(numCameras),
      price: parseFloat(price).toFixed(2),
      serialNumber,
      address,
      installationType,
      preferredDate: preferredDate || 'N/A',
      comments: comments || 'None',
      phone: phone || 'N/A'
    };
    sendSmtpEmail.attachment = [
      {
        name: `Installation_Invoice_${invoiceNumber}.pdf`,
        content: pdfBase64,
      },
    ];

    // Send email
    await apiInstance.sendTransacEmail(sendSmtpEmail);

    return res.status(200).json({ message: 'Installation invoice email sent successfully' });
  } catch (error) {
    console.error('Error sending installation invoice email:', error);
    return res.status(500).json({ error: `Failed to send installation invoice email: ${error.message}` });
  }
}