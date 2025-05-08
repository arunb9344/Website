const fetch = require('node-fetch');

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { booking, base64PDF } = req.body;

    if (!booking || !booking.email || !base64PDF) {
        return res.status(400).json({ error: 'Missing booking or PDF data' });
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const TEMPLATE_ID = parseInt(process.env.BREVO_TEMPLATE_ID, 10);

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { name: 'EyeTech Securities', email: 'no-reply@eyetechsecurities.in' },
                to: [{ email: booking.email, name: booking.name || 'Customer' }],
                subject: `EyeTech Securities Invoice for ${booking.name || 'Customer'}`,
                templateId: TEMPLATE_ID,
                params: booking,
                attachments: [{ content: base64PDF, name: 'invoice.pdf' }]
            })
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Brevo API error: ${response.status} - ${JSON.stringify(result)}`);
        }

        return res.status(200).json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: `Failed to send email: ${error.message}` });
    }
};