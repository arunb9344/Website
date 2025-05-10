const Brevo = require('@getbrevo/brevo');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    toEmail, // Admin email address
    customerName,
    phone,
    email,
    address,
    installationType,
    numCameras,
    preferredDate,
    comments
  } = req.body;

  // Validate required fields
  if (!toEmail || !customerName || !phone || !email || !address || !installationType || !numCameras || !preferredDate || !comments) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Initialize Brevo client
    const apiInstance = new Brevo.TransactionalEmailsApi();
    const apiKey = apiInstance.authentications['apiKey'];
    apiKey.apiKey = process.env.BREVO_API_KEY;

    // Configure email with template ID
    const sendSmtpEmail = new Brevo.SendSmtpEmail();
    sendSmtpEmail.sender = { name: 'EyeTech Securities', email: 'no-reply@eyetechsecurities.in' };
    sendSmtpEmail.to = [{ email: 'eyetechsecurities@gmail.com' }];
    sendSmtpEmail.subject = 'New Installation Booking Submission';
    sendSmtpEmail.templateId = parseInt(process.env.BREVO_INSTALLATION_BOOKING_TEMPLATE_ID);
    sendSmtpEmail.params = {
      customerName,
      phone,
      email,
      address,
      installationType,
      numCameras: parseInt(numCameras),
      preferredDate: preferredDate || 'N/A',
      comments: comments || 'None'
    };

    // Send email
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log('Installation booking email sent to:', toEmail);

    return res.status(200).json({ message: 'Installation booking email sent successfully' });
  } catch (error) {
    console.error('Error sending installation booking email:', error);
    return res.status(500).json({ error: `Failed to send installation booking email: ${error.message}` });
  }
}