// Text of the Terms of Service, Privacy Policy and Disclaimer for Rounds (rounds.hayaix.tech).
// The Privacy Policy describes what the code in this repository actually does; update it whenever
// data handling changes (firebase.ts, data/, ai/, firestore.rules, vite.config.ts).

import type { ReactNode } from 'react';
import type { LegalDoc } from './types';
import { AnonymousId } from './AnonymousId';
import { CONTACT_EMAIL } from './routes';
import type { LegalPageId } from './routes';

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);
const Mail = () => <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

const LINKS = {
  repo: 'https://github.com/thosuperman/rounds',
  license: 'https://github.com/thosuperman/rounds/blob/main/LICENSE',
  apache: 'https://www.apache.org/licenses/LICENSE-2.0',
  googlePrivacy: 'https://policies.google.com/privacy',
  googleTerms: 'https://policies.google.com/terms',
  firebasePrivacy: 'https://firebase.google.com/support/privacy',
  geminiTerms: 'https://ai.google.dev/gemini-api/terms',
  genAiPolicy: 'https://policies.google.com/terms/generative-ai/use-policy',
  hayaixTerms: 'https://hayaix.tech/terms',
  hayaixPrivacy: 'https://hayaix.tech/privacy',
  hayaixDisclaimer: 'https://hayaix.tech/disclaimer',
};

const Scope = () => (
  <p>
    Rounds is one of Tho Nguyen's personal projects showcased on hayaix.tech. This document covers Rounds only: the web
    app at <strong>rounds.hayaix.tech</strong> (the same app is also served at its Firebase Hosting addresses,
    rounds-hybrid-bfb0.web.app and rounds-hybrid-bfb0.firebaseapp.com). The hayaix.tech website and the other projects
    linked from it have their own documents. For reference, see the HAYAiX showcase's own documents:{' '}
    <Ext href={LINKS.hayaixTerms}>Terms</Ext>, <Ext href={LINKS.hayaixPrivacy}>Privacy</Ext> and{' '}
    <Ext href={LINKS.hayaixDisclaimer}>Disclaimer</Ext>. They do not govern Rounds.
  </p>
);

// ------------------------------------------------------------------------------------------ Terms

const terms: LegalDoc = {
  title: 'Terms of Service',
  lead: (
    <p>
      These terms explain the conditions for using Rounds. Rounds is a free, non-commercial hobby and hackathon project
      built for #BuildHybridAI 2026 by Tho Nguyen ("I", "me"). It is not a commercial service.
    </p>
  ),
  sections: [
    {
      id: 'scope',
      title: 'Scope',
      body: <Scope />,
    },
    {
      id: 'acceptance',
      title: 'Acceptance',
      body: (
        <p>
          By opening or using Rounds you agree to these terms, the <a href="/privacy">Privacy Policy</a> and the{' '}
          <a href="/disclaimer">Disclaimer</a>. If you do not agree, please do not use Rounds.
        </p>
      ),
    },
    {
      id: 'service',
      title: 'What Rounds is',
      body: (
        <ul>
          <li>Rounds is a demonstration of hybrid (on-device and cloud) AI for equipment inspection rounds. It uses a fictional equipment manual.</li>
          <li>It is provided free of charge, <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong>. Using it is voluntary and <strong>at your own risk</strong>.</li>
          <li>There are no user accounts with passwords. Each browser gets an anonymous account automatically when the app is opened.</li>
          <li>Rounds is not certified for industrial or safety use. Read the <a href="/disclaimer">Disclaimer</a> before relying on anything it shows.</li>
        </ul>
      ),
    },
    {
      id: 'permitted-use',
      title: 'Permitted use',
      body: (
        <p>
          You may use Rounds to try, evaluate and learn from it, for example as a hackathon judge, developer or interested
          visitor, in line with these terms and applicable law. Do not use it to run, record or decide real inspections of
          equipment.
        </p>
      ),
    },
    {
      id: 'prohibited',
      title: 'Prohibited activities',
      body: (
        <>
          <p>When using Rounds, you must not:</p>
          <ul>
            <li>attack, overload, scan or probe Rounds or the services it runs on, or interfere with other users;</li>
            <li>abuse the AI features, for example by sending automated or bulk requests or using Rounds as a free gateway to cloud AI models;</li>
            <li>bypass or tamper with Firebase App Check, the Firestore security rules or any other protection, or try to access data that is not yours;</li>
            <li>upload or enter content you have no right to share, including other people's personal information or confidential documents;</li>
            <li>upload or enter unlawful, harmful or infringing content, or malware;</li>
            <li>use the AI features in a way that breaks Google's <Ext href={LINKS.genAiPolicy}>Generative AI Prohibited Use Policy</Ext>.</li>
          </ul>
          <p>I may block, limit or delete data from use that breaks these rules.</p>
        </>
      ),
    },
    {
      id: 'content',
      title: 'Your content and AI-generated content',
      body: (
        <ul>
          <li>You keep any rights you have in the manuals, notes and other content you enter. You allow me to store and process it as needed to run Rounds, as described in the <a href="/privacy">Privacy Policy</a>.</li>
          <li>Content sent to cloud AI is also processed by Google under its own terms (see the Privacy Policy). Do not enter personal, confidential or sensitive information.</li>
          <li>AI-generated content, on the device or in the cloud, may be wrong, incomplete or misleading. It is advisory only.</li>
        </ul>
      ),
    },
    {
      id: 'ip',
      title: 'Intellectual property',
      body: (
        <ul>
          <li>
            The source code of Rounds is open source under the <strong>Apache License, Version 2.0</strong> (
            <Ext href={LINKS.license}>LICENSE in the repository</Ext>, <Ext href={LINKS.apache}>full text</Ext>). Your use
            of the code is governed by that license.
          </li>
          <li>The Apache License does not grant permission to use the names "Rounds" or "HAYAiX" as trademarks.</li>
          <li>Firebase, Gemini, Google and Chrome are trademarks of Google LLC. Rounds is not affiliated with or endorsed by Google.</li>
        </ul>
      ),
    },
    {
      id: 'no-warranty',
      title: 'No warranties',
      body: (
        <p>
          To the extent permitted by applicable law, I make no promises about Rounds, including about its availability,
          accuracy, reliability, security, uninterrupted or error-free operation, or fitness for a particular purpose.
          Rounds may change, break, lose data or be shut down at any time without notice.
        </p>
      ),
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      body: (
        <>
          <p>To the extent permitted by applicable law, I am not responsible for any loss or damage arising from:</p>
          <ul>
            <li>interruptions, downtime or shutdown of Rounds;</li>
            <li>software defects, bugs or security incidents;</li>
            <li>loss, corruption or deletion of data, including data saved on your device that was never synced;</li>
            <li>third-party services that Rounds depends on, including Firebase and other Google services;</li>
            <li>reliance on experimental features or on AI-generated content, whether produced on the device or in the cloud;</li>
            <li>decisions made or actions taken during real inspections, maintenance or operation of equipment.</li>
          </ul>
          <p>
            <strong>Nothing in these terms excludes or limits liability that cannot be excluded or limited under applicable
            law</strong>, including under the laws of Japan such as the Consumer Contract Act, and liability for intentional
            misconduct or gross negligence. If any part of these terms is found invalid or unenforceable, only that part is
            limited to the extent required, and the rest stays in effect.
          </p>
        </>
      ),
    },
    {
      id: 'changes',
      title: 'Changes and suspension',
      body: (
        <p>
          I may change, suspend or discontinue Rounds, and delete its data, at any time. I may also update these terms. The
          "Last updated" date at the top shows the current version. If you keep using Rounds after a change, the updated
          terms apply.
        </p>
      ),
    },
    {
      id: 'law',
      title: 'Governing law',
      body: (
        <p>
          These terms are governed by the laws of Japan. This does not take away any protection you have under mandatory
          laws, including consumer protection laws of the country where you live.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      body: (
        <p>
          Questions about these terms: <Mail />.
        </p>
      ),
    },
  ],
};

// ---------------------------------------------------------------------------------------- Privacy

const privacy: LegalDoc = {
  title: 'Privacy Policy',
  lead: (
    <p>
      This policy explains what data Rounds handles, why, where it goes and how long it is kept. It describes what the
      code of Rounds actually does (the code is <Ext href={LINKS.repo}>public</Ext>). Rounds is run by Tho Nguyen ("I",
      "me") as a personal project, and this policy follows Japan's Act on the Protection of Personal Information (APPI).
    </p>
  ),
  summary: (
    <>
      <h2>The short version</h2>
      <ul>
        <li>Rounds does not ask for your name, email or password. Opening the app creates an <strong>anonymous account</strong> (a random ID).</li>
        <li>What you enter (manuals, readings, notes, handovers) is stored in <strong>your own workspace</strong> in Cloud Firestore, in Tokyo. Only your anonymous account can read it.</li>
        <li>Note checks, questions and handover summaries run <strong>on your device</strong> with Chrome's Gemini Nano when it is available. They go to the cloud only if you switch on <strong>Cloud fallback</strong>.</li>
        <li>Manual compilation, consented cloud reviews and trend analysis use <strong>Google's Gemini in the cloud</strong>. Rounds uses Google's no-cost tier, under which <strong>Google may use this content to improve its products and human reviewers may read it</strong>. Do not enter personal, confidential or sensitive information.</li>
        <li>No analytics, no advertising, no tracking. Rounds sets no cookies itself. Google reCAPTCHA (bot protection) may.</li>
        <li>There is no automatic deletion. Email <Mail /> with your anonymous ID to have your data deleted.</li>
      </ul>
    </>
  ),
  sections: [
    {
      id: 'responsible',
      title: 'Who is responsible',
      body: (
        <p>
          Tho Nguyen, who runs Rounds as a free, non-commercial personal project. Contact: <Mail />.
        </p>
      ),
    },
    {
      id: 'scope',
      title: 'What this policy covers',
      body: (
        <>
          <Scope />
          <p>It does not cover copies of the open-source code that other people run themselves.</p>
        </>
      ),
    },
    {
      id: 'data',
      title: 'Data Rounds handles',
      body: (
        <>
          <p>
            Rounds does not ask for personal information. Free-text fields (uploaded manuals, notes, questions) will contain
            personal information only if you type it in, so please don't. The Terms prohibit entering other people's
            personal information.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>What it is</th>
                  <th>Where</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Anonymous account</td>
                  <td>A random user ID from Firebase Anonymous Authentication, created automatically when you open the app (not when you open these legal pages). The app shows a short label derived from it, such as "Tech 1A2B".</td>
                  <td>Firebase Authentication; your browser</td>
                </tr>
                <tr>
                  <td>Workspace</td>
                  <td>Owner ID, roles and creation time of your workspace.</td>
                  <td>Cloud Firestore</td>
                </tr>
                <tr>
                  <td>Manuals and procedure packs</td>
                  <td>The full text of each manual you compile (the built-in demo manual or a .md/.txt file you upload), the compiled pack (steps, limits, quotes, safety items) and its approval record (approver label, time, approved and excluded items).</td>
                  <td>Cloud Firestore; packs and manual text are also cached in your browser for offline use</td>
                </tr>
                <tr>
                  <td>Rounds, readings and notes</td>
                  <td>Round status and times; for each step the reading, unit, rule result, your note, the AI suggestion, your anonymous ID and the time.</td>
                  <td>Cloud Firestore</td>
                </tr>
                <tr>
                  <td>Issues and handovers</td>
                  <td>Deviations tracked across shifts (step, values, levels, notes, dates), shift handovers (facts, AI summary, actions) and acknowledgements.</td>
                  <td>Cloud Firestore</td>
                </tr>
                <tr>
                  <td>Cloud review requests</td>
                  <td>The exact text you agreed to send (shown in the consent dialog), the consent time, status, attempts and the cloud result.</td>
                  <td>Cloud Firestore</td>
                </tr>
                <tr>
                  <td>Hybrid ledger</td>
                  <td>A log of each AI call: task, inference mode, where it actually ran (on-device or cloud), duration, success or error, model name, online status, time, and round and step IDs. It does not contain the prompt text.</td>
                  <td>Cloud Firestore</td>
                </tr>
                <tr>
                  <td>Technical data</td>
                  <td>IP address, browser and device information sent with requests to Google's servers; App Check and reCAPTCHA signals; a Firebase Installations ID used by Remote Config.</td>
                  <td>Google (see sections 7 and 8)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ),
    },
    {
      id: 'use',
      title: 'Why it is used',
      body: (
        <ul>
          <li>To run the features you use: saving and syncing your workspace, working offline, and the AI features.</li>
          <li>To protect Rounds and its AI endpoints from abuse (Firebase App Check with reCAPTCHA).</li>
          <li>To choose which cloud models are used and switch cloud reviews off if needed (Remote Config).</li>
          <li>To answer your requests and keep Rounds working and secure.</li>
        </ul>
      ),
    },
    {
      id: 'storage',
      title: 'Cookies and browser storage',
      body: (
        <>
          <p>
            Rounds sets no cookies itself and uses no advertising or analytics cookies. Google reCAPTCHA, which App Check
            uses for bot protection, may set a cookie (such as <code>_GRECAPTCHA</code>) and read Google cookies for its
            risk analysis. This is strictly necessary to protect the service, so Rounds does not show a cookie banner.
          </p>
          <p>Rounds stores the following in your browser:</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Storage</th>
                  <th>Contents</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Local storage</td>
                  <td>
                    <code>rounds.tab</code> (last open tab), <code>rounds.cloudFallbackConsent</code> (your Cloud fallback
                    choice), <code>rounds.packcache.*</code> (approved packs for offline rounds),{' '}
                    <code>rounds.manualcache.*</code> (manual text used to build cloud review requests offline)
                  </td>
                </tr>
                <tr>
                  <td>IndexedDB (Firebase)</td>
                  <td>Your anonymous sign-in session, the Firestore offline copy of your workspace and changes not yet synced, the App Check token, and the Firebase Installations ID and Remote Config values</td>
                </tr>
                <tr>
                  <td>Service worker and cache</td>
                  <td>The app's own files (code, styles, icon) so it opens offline. No user data.</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Chrome manages the on-device model (Gemini Nano) itself; Rounds does not store it. You can remove all of the
            above by clearing site data for rounds.hayaix.tech in your browser. This deletes the local copies and changes
            that have not synced, and you lose access to your anonymous workspace. The copy in Cloud Firestore stays until
            it is deleted (see section 9).
          </p>
        </>
      ),
    },
    {
      id: 'analytics',
      title: 'Analytics',
      body: (
        <p>
          None. Rounds does not use Google Analytics or any other analytics, advertising or tracking tools, and does not
          sell or share data for advertising. Google may keep server logs of requests to Firebase services under its own
          policies. Rounds does not use them to track or profile visitors.
        </p>
      ),
    },
    {
      id: 'providers',
      title: 'Third-party providers and data sent to them',
      body: (
        <>
          <p>
            Rounds runs on Google services. Google processes data on my behalf to provide them, under the{' '}
            <Ext href={LINKS.googlePrivacy}>Google Privacy Policy</Ext>, the <Ext href={LINKS.googleTerms}>Google Terms of Service</Ext>{' '}
            and <Ext href={LINKS.firebasePrivacy}>Firebase's privacy information</Ext>.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Data sent</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Firebase Hosting</td>
                  <td>Standard web requests (IP address, browser, requested page)</td>
                  <td>Delivering the app</td>
                </tr>
                <tr>
                  <td>Firebase Authentication</td>
                  <td>Anonymous sign-in requests and tokens</td>
                  <td>Your anonymous account</td>
                </tr>
                <tr>
                  <td>Cloud Firestore</td>
                  <td>Your workspace data (section 3)</td>
                  <td>Storing and syncing your workspace</td>
                </tr>
                <tr>
                  <td>Firebase App Check with reCAPTCHA (Google Cloud Fraud Defense)</td>
                  <td>Device, browser and interaction signals that reCAPTCHA collects for risk analysis</td>
                  <td>Blocking automated abuse of Firestore and the AI features</td>
                </tr>
                <tr>
                  <td>Firebase Remote Config and Installations</td>
                  <td>An installation ID and app information</td>
                  <td>Model choice and the cloud review switch</td>
                </tr>
                <tr>
                  <td>Firebase AI Logic with the Gemini Developer API</td>
                  <td>The text of cloud AI requests (section 8)</td>
                  <td>Cloud AI features</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ),
    },
    {
      id: 'ai',
      title: 'AI processing',
      body: (
        <>
          <h3>On your device</h3>
          <p>
            Checking a note, asking about a step and writing the handover summary are set to run on the device first
            (Firebase AI Logic <code>PREFER_ON_DEVICE</code>). When Chrome's built-in Gemini Nano is available, this text is
            processed on your device. Every AI result is labelled with where it actually ran, as reported by the SDK, and
            the Hybrid ledger records it.
          </p>
          <h3>Cloud fallback (off unless you switch it on)</h3>
          <p>
            If your device has no local model, these tasks are refused unless you switch on <strong>Cloud fallback</strong>{' '}
            and confirm. With it on, the note or question, the step card, and the handover facts are sent to Gemini in the
            cloud. You can switch it off again at any time.
          </p>
          <h3>Cloud-only tasks</h3>
          <ul>
            <li><strong>Compiling a manual:</strong> the full text of the manual you choose is sent.</li>
            <li><strong>Cloud review:</strong> only after you see the exact text in a consent dialog and agree. It includes the step, approved limits, your reading and note, the relevant manual section and this check's history. Offline, the request waits on your device and in your workspace and is sent automatically when you are back online.</li>
            <li><strong>Trend analysis:</strong> when you press "Find recurring problems (cloud)", the issue history of your workspace (steps, values, levels, dates and notes) is sent.</li>
          </ul>
          <h3>How Google uses cloud AI content</h3>
          <p>
            Rounds uses the no-cost tier of the Gemini Developer API. Under the{' '}
            <Ext href={LINKS.geminiTerms}>Gemini API Additional Terms of Service</Ext> for unpaid services, Google uses the
            content submitted and the responses to provide, improve and develop its products and machine learning
            technologies, and human reviewers may read, annotate and process it. Google says it disconnects this data from
            the Google account, API key and Cloud project before reviewers see it. Google also asks that{' '}
            <strong>no sensitive, confidential or personal information</strong> be submitted, so please don't enter any in
            Rounds. I do not train any AI models with your content.
          </p>
        </>
      ),
    },
    {
      id: 'retention',
      title: 'Retention and deletion',
      body: (
        <>
          <ul>
            <li>Data in Cloud Firestore has no automatic expiry. To keep audit records intact, the app cannot delete it, and the security rules block deletion from the app.</li>
            <li>I may delete demo data at any time, and I will delete all of it if Rounds is shut down.</li>
            <li>To have your workspace deleted sooner, email <Mail /> with your anonymous ID. You can see the ID stored in this browser here:</li>
          </ul>
          <AnonymousId />
          <p>
            The button above loads Firebase in this page only to read the ID already stored in your browser. It does not
            create an account. Google keeps its own logs and cloud AI content according to its own policies (sections 7 and 8).
          </p>
        </>
      ),
    },
    {
      id: 'security',
      title: 'Security',
      body: (
        <ul>
          <li>All connections use HTTPS.</li>
          <li>Firebase App Check is enforced on Cloud Firestore and Firebase AI Logic.</li>
          <li>Firestore security rules limit each workspace to its own anonymous account. Approved packs cannot be changed, and the ledger is append-only.</li>
          <li>No system is perfectly secure, and Rounds is a demo. Do not store sensitive information in it.</li>
        </ul>
      ),
    },
    {
      id: 'transfers',
      title: 'International data transfers',
      body: (
        <p>
          Your Firestore workspace is stored in Google Cloud's Tokyo region (asia-northeast1). Other Google services
          Rounds uses (Firebase Hosting's global network, Authentication, App Check and reCAPTCHA, Remote Config and the
          Gemini Developer API) may process data in the United States and other countries where Google operates. Google
          LLC is based in the United States, which has no single national data protection law equivalent to the APPI.
          Google describes its safeguards in the <Ext href={LINKS.googlePrivacy}>Google Privacy Policy</Ext>.
        </p>
      ),
    },
    {
      id: 'rights',
      title: 'Your rights',
      body: (
        <>
          <p>
            Under the APPI you can ask me to disclose, correct, add to or delete personal data I hold about you, to stop
            using it or providing it to third parties, and to disclose records of third-party provision. You may have
            similar or additional rights under the laws of where you live.
          </p>
          <p>
            Email <Mail /> with your request and your anonymous ID (section 9). Because accounts are anonymous, I may ask
            you to show that you control the browser that holds the ID. Requests are free, and I will reply within a
            reasonable time.
          </p>
        </>
      ),
    },
    {
      id: 'children',
      title: 'Children',
      body: <p>Rounds is a tool demo for adults working in maintenance. It is not directed at children, and I do not knowingly collect data from children.</p>,
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: <p>If the way Rounds handles data changes, I will update this policy and the "Last updated" date at the top.</p>,
    },
    {
      id: 'contact',
      title: 'Contact and privacy inquiries',
      body: (
        <p>
          <Mail />
        </p>
      ),
    },
  ],
};

// ------------------------------------------------------------------------------------- Disclaimer

const disclaimer: LegalDoc = {
  title: 'Disclaimer',
  lead: (
    <p>
      Please read this before using Rounds. It explains what Rounds is not, and why its output must never replace your own
      approved procedures.
    </p>
  ),
  sections: [
    {
      id: 'scope',
      title: 'Scope',
      body: <Scope />,
    },
    {
      id: 'prototype',
      title: 'A hackathon prototype',
      body: (
        <p>
          Rounds is a free prototype built for the #BuildHybridAI 2026 hackathon to demonstrate hybrid on-device and cloud
          AI. It is not a finished product and is not maintained as a commercial service.
        </p>
      ),
    },
    {
      id: 'not-certified',
      title: 'Not certified for industrial or safety use',
      body: (
        <p>
          Rounds is <strong>not certified</strong> under any industrial, safety or regulatory standard. Do not use it to
          make safety decisions about real equipment, or as a substitute for an approved inspection system.
        </p>
      ),
    },
    {
      id: 'fictional',
      title: 'Fictional demo data',
      body: (
        <p>
          The built-in manual (the "AquaLift CP-40" pump) is fictional and marked DEMO ONLY. Its equipment, values and
          limits were invented for the demo and must not be used for real equipment. The "Seed demo history" button adds
          synthetic, labelled readings.
        </p>
      ),
    },
    {
      id: 'ai',
      title: 'AI suggestions can be wrong',
      body: (
        <ul>
          <li>Suggestions from the on-device model (Gemini Nano in Chrome) and the cloud model (Gemini) can be wrong, incomplete or misleading.</li>
          <li>They never replace approved procedures, the manufacturer's instructions, qualified staff, or the operator's own safety rules.</li>
          <li>In Rounds, limits are checked by deterministic rules. Those rules come from procedures that people review and approve. They are only as good as that procedure and that review. The app's checks catch some errors, not all of them.</li>
        </ul>
      ),
    },
    {
      id: 'devices',
      title: 'Device and browser support',
      body: (
        <p>
          On-device AI needs a supported desktop version of Chrome with built-in AI on hardware that meets Chrome's
          requirements. On other browsers and devices, including phones, features differ: readings and rules still work,
          and AI help is available only through the cloud after you switch on Cloud fallback. On-device AI can be slow
          (tens of seconds per request on a laptop).
        </p>
      ),
    },
    {
      id: 'no-guarantee',
      title: 'No guarantees',
      body: (
        <p>
          Rounds comes with no guarantee of accuracy, completeness, availability or fitness for a particular purpose.
          Changes saved offline may be lost if browser data is cleared before they sync. Firebase, Gemini, Google and Chrome
          are trademarks of Google LLC. Rounds is not affiliated with or endorsed by Google.
        </p>
      ),
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      body: (
        <p>
          See <a href="/terms#liability">Limitation of liability</a> in the Terms of Service. Nothing in this disclaimer
          limits liability that cannot be limited under applicable law.
        </p>
      ),
    },
    {
      id: 'contact',
      title: 'Contact',
      body: (
        <p>
          <Mail />
        </p>
      ),
    },
  ],
};

export const PAGES: Record<LegalPageId, LegalDoc> = { terms, privacy, disclaimer };
