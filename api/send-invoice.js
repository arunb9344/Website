const Brevo = require('@getbrevo/brevo');
const PDFDocument = require('pdfkit');
const { Buffer } = require('buffer');

// Helper function to generate PDF invoice
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
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('EyeTech Securities', 50, 50)
        .fontSize(10)
        .font('Helvetica')
        .text('No.56/80, 1st Floor, Medavakkam Main Road', 50, 80)
        .text('Chennai, Tamil Nadu 600117, India', 50, 95)
        .text('Phone: +91-9962835944', 50, 110)
        .text('Email: info@eyetechsecurities.in', 50, 125)
        .moveDown();

      // Invoice Title
      doc
        .fontSize(16)
        .font('Helvetica-Bold')
        .text('Invoice', 50, 160)
        .moveDown();

      // Invoice Details
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice Number: ${booking.invoiceNumber}`, 50, 190)
        .text(`Invoice Date: ${booking.invoiceDate}`, 50, 205)
        .text(`Customer Name: ${booking.customerName}`, 50, 220)
        .moveDown();

      // Table Header
      const tableTop = 250;
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Description', 50, tableTop)
        .text('Amount (INR)', 400, tableTop);

      // Table Row
      doc
        .font('Helvetica')
        .text(`CCTV Service - ${booking.issue}`, 50, tableTop + 20)
        .text(`${booking.amount.toFixed(2)}`, 400, tableTop + 20);

      // Solution Provided
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Solution Provided:', 50, tableTop + 60)
        .text(booking.solution, 50, tableTop + 75, { width: 500 });

      // Total
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text(`Total: INR ${booking.amount.toFixed(2)}`, 400, tableTop + 120);

      // Footer
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Thank you for choosing EyeTech Securities!', 50, doc.page.height - 100, { align: 'center' })
        .text('For queries, contact us at info@eyetechsecurities.in or +91-9962835944', 50, doc.page.height - 85, { align: 'center' });

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

  const { toEmail, customerName, invoiceNumber, invoiceDate, amount, issue, solution } = req.body;

  // Validate request body
  if (!toEmail || !customerName || !invoiceNumber || !invoiceDate || !amount || !issue || !solution) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Generate PDF
    const pdfBase64 = await generatePDF({
      customerName,
      invoiceNumber,
      invoiceDate,
      amount: parseFloat(amount),
      issue,
      solution,
    });

    // Initialize Brevo client
    const apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    // Configure email with template ID
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'EyeTech Securities', email: 'no-reply@eyetechsecurities.in' };
    sendSmtpEmail.to = [{ email: toEmail }];
    sendSmtpEmail.subject = `Your Invoice ${invoiceNumber} from EyeTech Securities`;
    sendSmtpEmail.templateId = parseInt(process.env.BREVO_TEMPLATE_ID); // Use template ID from env
    sendSmtpEmail.params = {
      customerName,
      invoiceNumber,
      invoiceDate,
      issue,
      solution,
      amount: parseFloat(amount).toFixed(2),
    };
    sendSmtpEmail.attachment = [
      {
        name: `Invoice_${invoiceNumber}.pdf`,
        content: pdfBase64,
      },
    ];

    // Send email
    await apiInstance.sendTransacEmail(sendSmtpEmail);

    return res.status(200).json({ message: 'Invoice email sent successfully' });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return res.status(500).json({ error: `Failed to send invoice email: ${error.message}` });
  }
}