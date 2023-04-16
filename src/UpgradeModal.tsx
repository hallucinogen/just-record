import React from 'react';
import Modal from 'react-modal';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const styles: { [key: string]: React.CSSProperties } = {
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '16px',
    maxWidth: '400px',
    margin: 'auto',
    height: 'fit-content'
  },
  closeButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    backgroundColor: '#f5f5f7',
    borderRadius: '50%',
    padding: '6px',
    color: '#1c1c1e',
    fontWeight: 400,
    border: 'none',
    outline: 'none',
    cursor: 'pointer',
  },
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    color: '#007bff',
    textDecoration: 'none',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  form: {
    marginTop: '10px',
  },
  input: {
    display: 'block',
    width: 'calc(100% - 24px)',
    padding: '6px 12px',
    fontSize: '14px',
    lineHeight: '1.42857143',
    color: '#555',
    backgroundColor: '#fff',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginBottom: '10px',
  },
  submitButton: {
    backgroundColor: '#007bff',
    color: '#fff',
    borderRadius: '24px',
    padding: '6px 12px',
    fontSize: '16px',
    lineHeight: '1.42857143',
    cursor: 'pointer',
    border: 'none',
  },
  buyNowButton: {
    display: 'block',
    backgroundColor: '#28a745',
    color: '#fff',
    borderRadius: '24px',
    padding: '6px 12px',
    fontSize: '16px',
    lineHeight: '1.42857143',
    textDecoration: 'none',
    marginTop: '10px',
    width: 'fit-content'
  },
};

async function validateLicense(licenseKey: string) {
  const url = 'https://api.lemonsqueezy.com/v1/licenses/validate';
  const headers = new Headers({
    'Accept': 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded'
  });

  const data = new URLSearchParams({
    license_key: licenseKey,
  });

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: headers,
    body: data.toString()
  };

  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    return result.valid == true;
  } catch (error) {
    console.error('Error:', error);
  }

  return false;
}

const UpgradeModal: React.FC<Props> = ({ isVisible, onClose, onUpgrade }) => {
  const [licenseKey, setLicenseKey] = React.useState('');
  const [showForm, setShowForm] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const isValid = await validateLicense(licenseKey);
    
    if (isValid) {
      onUpgrade();

      // TODO: make good UI that we've upgraded
      onClose();
      console.log("License is valid");
    } else {
      console.log("License is invalid");
    }
  };

  return (
    <Modal
      isOpen={isVisible}
      onRequestClose={onClose}
      style={{
        overlay: styles.modalOverlay,
        content: styles.modalContent,
      }}
    >
      <h2>Upgrade to unlock full features</h2>
      <p>Get unlimited recording duration and more features by upgrading to the premium version.</p>
      <a style={styles.link} onClick={(e) => setShowForm(true)}>I already bought a license</a>
      {showForm ? (
        <form style={styles.form} onSubmit={handleSubmit}>
          <input
            style={styles.input}
            type="text"
            placeholder="Enter License Key"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value)}
          />
          <button style={styles.submitButton} type="submit">Submit</button>
        </form>
      ): null}

      <a href="https://hallucinogenstudio.lemonsqueezy.com/checkout/buy/272abda2-bea0-4460-a770-40a67fc0ec5e" target="_blank" rel="noopener noreferrer" style={styles.buyNowButton}>
        Buy Now
      </a>

      <button style={styles.closeButton} onClick={onClose}>
        ✖️
      </button>
    </Modal>
  );
};

export default UpgradeModal;
