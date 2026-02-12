const { requireAuth } = require("../middleware/apiAuth");
const express = require('express');
const router = express.Router();

const SETUP_STEPS = [
  { step: 1, title: 'Unbox Your Tablet', icon: '📦', description: 'Remove the tablet from its box. You will find the tablet, a charging cable, and this setup guide.', time: '1 min' },
  { step: 2, title: 'Charge the Tablet', icon: '🔌', description: 'Connect the charging cable and charge for at least 30 minutes before first use. The light will turn green when ready.', time: '30 min' },
  { step: 3, title: 'Turn On & Connect WiFi', icon: '📶', description: 'Press and hold the power button for 3 seconds. When the screen lights up, tap your WiFi network name and enter the password.', time: '2 min' },
  { step: 4, title: 'Open Warda', icon: '🌹', description: 'Tap the Warda icon on the home screen. It will open automatically. If not, open the web browser and go to app.meetwarda.com.', time: '1 min' },
  { step: 5, title: 'Enter Your PIN', icon: '🔢', description: 'Enter the 4-digit PIN provided by your care team or in your welcome email. This keeps Warda personal and secure.', time: '30 sec' },
  { step: 6, title: 'Meet Warda', icon: '😊', description: 'Say hello! Tap "Talk to Warda" and have your first conversation. Warda already knows about your loved one from the questionnaire.', time: '5 min' },
  { step: 7, title: 'Place the Tablet', icon: '🏠', description: 'Place the tablet on a table or bedside where it is easy to see and reach. Keep the charger nearby for overnight charging.', time: '1 min' },
];

const FAQ = [
  { q: 'What if the tablet won\'t turn on?', a: 'Make sure it has been charging for at least 30 minutes. Try holding the power button for 10 seconds.' },
  { q: 'What if WiFi won\'t connect?', a: 'Check the WiFi password is correct. Move the tablet closer to the router. Restart the router if needed.' },
  { q: 'How do I change the PIN?', a: 'Contact your care team or log into the family app to change the PIN in Settings.' },
  { q: 'Can my mum call us through Warda?', a: 'Yes! Tap "Family" on the home screen to see contacts and start a video call.' },
  { q: 'Is my data safe?', a: 'Absolutely. All data is encrypted and stored securely. We comply with NHS Data Security standards and GDPR.' },
  { q: 'What happens if the tablet breaks?', a: 'Contact us and we will arrange a replacement. Your data is safely backed up in the cloud.' },
];

// GET /api/setup/guide - Full setup guide
router.get('/guide', requireAuth, (req, res) => {
  res.json({ success: true, steps: SETUP_STEPS, totalTime: '~40 minutes (mostly charging)', faq: FAQ });
});

// GET /api/setup/step/:num - Individual step
router.get('/step/:num', requireAuth, (req, res) => {
  const step = SETUP_STEPS.find(s => s.step === parseInt(req.params.num));
  if (!step) return res.status(404).json({ error: 'Step not found' });
  res.json({ success: true, step, total: SETUP_STEPS.length });
});

// GET /api/setup/faq - FAQ only
router.get('/faq', requireAuth, (req, res) => {
  res.json({ success: true, faq: FAQ });
});

module.exports = router;
