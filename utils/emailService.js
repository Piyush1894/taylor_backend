const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

const sendEmail = async ({ to, subject, html, text }) => {
    try {
        const transporter = createTransporter();
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'TailorApp <noreply@tailorapp.com>',
            to,
            subject,
            html,
            text,
        });
        console.log(`📧 Email sent to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        return { success: false, error: error.message };
    }
};

// Email templates
const sendBookingRequestEmail = async (tailorEmail, customerName, bookingId) => {
    return sendEmail({
        to: tailorEmail,
        subject: '🪡 New Booking Request',
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#4a4a4a;">New Booking Request</h2>
        <p>Hi, you have a new booking request from <strong>${customerName}</strong>.</p>
        <p>Booking ID: <strong>${bookingId}</strong></p>
        <p>Please login to your account to accept or reject this request.</p>
        <a href="${process.env.CLIENT_URL}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">View Booking</a>
        <p style="margin-top:20px;font-size:12px;color:#888;">TailorApp Team</p>
      </div>
    `,
    });
};

const sendBookingStatusEmail = async (email, name, status, bookingId) => {
    const statusMessages = {
        tailor_accepted: 'Your booking has been accepted! You can now chat with the tailor.',
        tailor_rejected: 'Unfortunately, your booking request was rejected.',
        customer_confirmed: 'The booking has been confirmed successfully.',
        in_progress: 'Your order is now in progress!',
        completed: 'Your order is ready for delivery! Please confirm receipt.',
        cancelled: 'Your booking has been cancelled.',
    };
    return sendEmail({
        to: email,
        subject: `📋 Booking Update - ${bookingId}`,
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#4a4a4a;">Booking Update</h2>
        <p>Hi ${name},</p>
        <p>${statusMessages[status] || `Your booking status has been updated to: ${status}`}</p>
        <p>Booking ID: <strong>${bookingId}</strong></p>
        <a href="${process.env.CLIENT_URL}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">View Details</a>
        <p style="margin-top:20px;font-size:12px;color:#888;">TailorApp Team</p>
      </div>
    `,
    });
};

const sendWelcomeEmail = async (email, name) => {
    return sendEmail({
        to: email,
        subject: '🎉 Welcome to TailorApp!',
        html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#f9f9f9;border-radius:8px;">
        <h2 style="color:#4a4a4a;">Welcome, ${name}!</h2>
        <p>Thank you for joining TailorApp. Discover the best tailors near you.</p>
        <a href="${process.env.CLIENT_URL}" style="background:#007bff;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;">Get Started</a>
        <p style="margin-top:20px;font-size:12px;color:#888;">TailorApp Team</p>
      </div>
    `,
    });
};

module.exports = {
    sendEmail,
    sendBookingRequestEmail,
    sendBookingStatusEmail,
    sendWelcomeEmail,
};
