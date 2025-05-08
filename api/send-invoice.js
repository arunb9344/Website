const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.error('Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { booking, base64PDF } = req.body;

    // Validate request body
    if (!booking || !booking.email || !base64PDF) {
        console.error('Missing required fields:', { booking: !!booking, email: !!booking?.email, base64PDF: !!base64PDF });
        return res.status(400).json({ error: 'Missing booking, email, or PDF data' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(booking.email)) {
        console.error('Invalid email format:', booking.email);
        return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate Base64 PDF
    const base64Regex = /^[A-Za-z0-9+/=]+$/;
    if (!base64Regex.test(base64PDF)) {
        console.error('Invalid Base64 PDF data');
        return res.status(400).json({ error: 'Invalid Base64 PDF data' });
    }

    // Check Base64 size (Brevo limit ~10MB, Base64 inflates by ~33%)
    const maxBase64Length = 7.5 * 1024 * 1024 * 4 / 3; // ~10MB
    if (base64PDF.length > maxBase64Length) {
        console.error('Base64 PDF too large:', base64PDF.length, 'characters');
        return res.status(400).json({ error: 'PDF attachment too large. Must be under 7.5MB.' });
    }

    // Validate environment variables
    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    const TEMPLATE_ID = parseInt(process.env.BREVO_TEMPLATE_ID, 10);

    if (!BREVO_API_KEY) {
        console.error('BREVO_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error: Missing BREVO_API_KEY' });
    }

    if (!TEMPLATE_ID || isNaN(TEMPLATE_ID)) {
        console.error('Invalid BREVO_TEMPLATE_ID:', process.env.BREVO_TEMPLATE_ID);
        return res.status(500).json({ error: 'Server configuration error: Invalid BREVO_TEMPLATE_ID' });
    }

    // Sanitize booking object to remove undefined/null values
    const sanitizedBooking = {};
    Object.keys(booking).forEach(key => {
        if (booking[key] !== undefined && booking[key] !== null) {
            sanitizedBooking[key] = booking[key];
        }
    });

    // Log request details
    console.log('Sending email with payload:', {
        to: booking.email,
        name: booking.name || 'Customer',
        templateId: TEMPLATE_ID,
        base64PDFLength: base64PDF.length,
        params: sanitizedBooking
    });

    try {
        const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
                'accept': 'application/json',
                'api-key': BREVO_API_KEY,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                sender: { 
                    name: 'EyeTech Securities', 
                    email: 'no-reply@eyetechsecurities.in' // Ensure this is verified in Brevo
                },
                to: [{ email: booking.email, name: booking.name || 'Customer' }],
                subject: `EyeTech Securities Invoice for ${booking.name || 'Customer'}`,
                templateId: TEMPLATE_ID,
                params: sanitizedBooking,
                attachments: [{ content: base64PDF, name: 'invoice.pdf' }]
            })
        });

        const result = await response.json();
        console.log('Brevo API response:', {
            status: response.status,
            result
        });

        if (!response.ok) {
            let errorMessage = `Brevo API error: ${response.status} - ${JSON.stringify(result)}`;
            if (response.status === 401) {
                errorMessage = 'Authentication error: Invalid BREVO_API_KEY. Check Vercel environment variables.';
            } else if (response.status === 400) {
                errorMessage = `Bad request: ${result.message || 'Check BREVO_TEMPLATE_ID and template parameters.'}`;
            } else if (response.status === 429) {
                errorMessage = 'Rate limit exceeded: Too many requests to Brevo API. Try again later.';
            }
            throw new Error(errorMessage);
        }

        console.log('Email sent successfully, messageId:', result.messageId);
        return res.status(200).json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Error sending email:', error.message);
        return res.status(500).json({ error: `Failed to send email: ${error.message}` });
    }
};