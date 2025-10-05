import Modal from "@oldcord/frontend-shared/components/modal";
import Button from "@oldcord/frontend-shared/components/button";
import { Text } from "@oldcord/frontend-shared/components/textComponent";

export default function ({ onClose, onConfirm, legalLinks }) {
  return (
    <Modal
      onClose={onClose}
      title="Legal Agreement"
      showCloseButton={false}
      size="small"
      footerAlignment="right"
      footer={
        <>
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button onClick={() => onConfirm()}>I Agree</Button>
        </>
      }
    >
      <div style={{ paddingBottom: "20px" }}>
        <Text variant="body">By continuing, you agree to our:</Text>
        <ul style={{ listStyle: "none", padding: 0, margin: "16px 0" }}>
          {legalLinks.map((link, index) => (
            <li key={index} style={{ margin: "8px 0" }}>
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#00aff4",
                  textDecoration: "none",
                  transition: "text-decoration 0.2s",
                }}
                onMouseOver={(e) =>
                  (e.target.style.textDecoration = "underline")
                }
                onMouseOut={(e) => (e.target.style.textDecoration = "none")}
              >
                <Text variant="body">{link.title}</Text>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Modal>
  );
}
