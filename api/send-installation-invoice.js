async function sendInstallationInvoiceEmail(booking) {
    console.log('Attempting to send installation invoice email for booking:', booking);
    if (!booking.email) {
        console.warn('No email provided for booking:', booking.id);
        errorMessage.textContent = 'Cannot send installation invoice: No email provided.';
        errorMessage.classList.add('active');
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(booking.email)) {
        console.warn('Invalid email format for booking:', booking.id, 'Email:', booking.email);
        errorMessage.textContent = 'Cannot send installation invoice: Invalid email format.';
        errorMessage.classList.add('active');
        return false;
    }

    try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch('/api/send-installation-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                toEmail: booking.email,
                customerName: booking.name || 'Customer',
                invoiceNumber: booking.invoiceNumber || 'N/A',
                invoiceDate: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('/'),
                numCameras: booking.numCameras || 0,
                price: booking.price || 0,
                serialNumber: booking.serialNumber || 'N/A',
                address: booking.address || 'N/A',
                installationType: booking.installationType || 'N/A',
                preferredDate: booking.preferredDate || 'N/A',
                comments: booking.comments || 'N/A'
            })
        });

        const result = await response.json();
        console.log('Installation API response:', response.status, result);

        if (!response.ok) {
            throw new Error(result.error || 'Failed to send installation invoice email');
        }

        console.log('Installation email sent successfully to:', booking.email);
        successMessage.textContent = `Installation invoice sent to ${booking.email}!`;
        successMessage.classList.add('active');
        errorMessage.classList.remove('active');

        setTimeout(() => {
            successMessage.classList.remove('active');
        }, 3000);

        return true;
    } catch (error) {
        console.error('Installation email sending error:', error);
        errorMessage.textContent = `Failed to send installation invoice email: ${error.message}`;
        errorMessage.classList.add('active');
        successMessage.classList.remove('active');
        return false;
    }
}