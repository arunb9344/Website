const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Set CORS headers for all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        console.log('Received OPTIONS request for /api/send-invoice');
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        console.error('Invalid method:', req.method);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('Received POST request to /api/send-invoice');

    const { booking, base64PDF } = req.body;

    // Log incoming payload
    console.log('Request payload:', {
        booking: booking ? { ...booking, email: booking.email || 'missing' } : 'missing',
        base64PDFLength: base64PDF ? base64PDF.length : 'missing'
    });

    // Validate request body
    if (!booking || !booking.email || !base64PDF) {
        console.error('Missing required fields:', {
            booking: !!booking,
            email: !!booking?.email,
            base64PDF: !!base64PDF
        });
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
    const BREVO_API_KEY = process.env.BREVO_API_KEY?.trim();
    const TEMPLATE_ID = parseInt(process.env.BREVO_TEMPLATE_ID, 10);

    if (!BREVO_API_KEY) {
        console.error('BREVO_API_KEY is not set or empty');
        return res.status(500).json({ error: 'Server configuration error: Missing BREVO_API_KEY' });
    }

    if (!TEMPLATE_ID || isNaN(TEMPLATE_ID)) {
        console.error('Invalid BREVO_TEMPLATE_ID:', process.env.BREVO_TEMPLATE_ID);
        return res.status(500).json({ error: 'Server configuration error: Invalid BREVO_TEMPLATE_ID' });
    }

    // Sanitize booking object to remove undefined/null values
    const sanitizedBooking = {
        email: booking.email,
        name: booking.name || 'Customer',
        amount: booking.amount || '0',
        issue: booking.issue || 'N/A',
        solution: booking.solution || 'Awaiting Solution',
        status: booking.status || 'Pending',
        invoice_date: booking.invoice_date || new Date().toLocaleDateString()
    };

    // Log sanitized payload
    console.log('Sanitized payload for Brevo:', {
        to: sanitizedBooking.email,
        name: sanitizedBooking.name,
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
                    email: 'no-reply@eyetechsecurities.in' // Must be verified in Brevo
                },
                to: [{ email: sanitizedBooking.email, name: sanitizedBooking.name }],
                subject: `EyeTech Securities Invoice for ${sanitizedBooking.name}`,
                templateId: TEMPLATE_ID,
                params: sanitizedBooking,
                attachments: [{ content: base64PDF, name: 'invoice.pdf' }]
            })
        });

        const result = await response.json();
        console.log('Brevo API response:', {
            status: response.status,
            ok: response.ok,
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

        if (!result.messageId) {
            console.warn('Brevo accepted request but no messageId returned:', result);
            return res.status(500).json({ error: 'Email request accepted but no messageId returned. Check Brevo configuration.' });
        }

        console.log('Email queued successfully, messageId:', result.messageId);
        return res.status(200).json({ success: true, messageId: result.messageId });
    } catch (error) {
        console.error('Error sending email:', error.message);
        return res.status(500).json({ error: `Failed to send email: ${error.message}` });
    }
};