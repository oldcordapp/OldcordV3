import { Text } from "../../../../../../shared/components/textComponent";
import Button from "../../../../../../shared/components/button";
import { useState } from "react";
import PageInfo from "../../../../../../shared/components/pageInfo";
import DropdownList from "../../../../../../shared/components/dropdownList";
import InputField from "../../../../../../shared/components/inputField";
import SubmitReport from "../modals/submitReport";

export default function () {
  const [isSubmitReportModalOpen, setIsSubmitReportModalOpen] = useState(false);
  const [selectedReportProblem, setSelectedReportProblem] = useState(
    "Direct Threats of Violence/Harm"
  );
  const [emailAddress, setEmailAddress] = useState("");
  const [reportSubject, setReportSubject] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const problems = [
    "Child Sexual Abuse Material (CSAM)",
    "Threat of Self-Harm or Suicide",
    "Terrorism or Violent Extremism",
    "Direct Threats of Violence/Harm",
    "Targeted Harassment or Bullying",
    "Hate Speech or Discrimination",
    "Non-Consensual Intimate Imagery (NCII)",
    "Spam, Scams, or Malware",
    "Copyright or Trademark Infringement",
    "Pornography or Sexually Explicit Content (where prohibited)",
    "Impersonation or Identity Theft",
    "Revealing Private Information (Doxxing)",
    "Other",
  ];

  const handleSubmitReport = async () => {
    await fetch(`${location.protocol}//${location.host}/api/reports`, {
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      body: JSON.stringify({
        subject: reportSubject,
        description: reportDescription,
        email_address: emailAddress === "" ? null : emailAddress,
        problem: selectedReportProblem,
      }),
    });
  };

  return (
    <>
      <Text variant="h1">Report Content</Text>
      <PageInfo title="Report Content">
        <>
          Use the form below to report any content that violates this instance's
          rules.
          <br />
          Please be aware that the response time depends on the nature of the
          report; those concerning <b>illegal content</b> (e.g, CSAM, terrorism)
          will be taken more seriously and prioritized.
          <br />
          Allow up to <b>one week</b> for the instance administrators to
          acknowledge your report. If there is no response, please attempt to
          contact them directly.
          <br />
          If illegal content is still present after this follow up, you may need
          to report it through <b>legal channels</b> to ensure the safety of all
          users.
        </>
      </PageInfo>
      <DropdownList
        label={"What's the problem?"}
        options={problems}
        defaultOption={selectedReportProblem}
        onSelected={setSelectedReportProblem}
        style={{ marginTop: "-20px" }}
        informativeText="Select the reason for your report."
      />
      <InputField
        label="Your Email Address"
        id="email-address"
        placeholder=""
        required={false}
        type="email"
        style={{ marginBottom: "20px" }}
        value={emailAddress}
        onChange={(e) => setEmailAddress(e.target.value)}
      />
      <InputField
        label="Subject"
        id="report-subject"
        placeholder=""
        required={true}
        type="text"
        style={{ marginBottom: "20px" }}
        value={reportSubject}
        onChange={(e) => setReportSubject(e.target.value)}
      />
      <InputField
        label="Description"
        id="report-description"
        placeholder=""
        required={true}
        type="textarea"
        style={{ marginBottom: "20px" }}
        value={reportDescription}
        onChange={(e) => setReportDescription(e.target.value)}
      />
      <span
        style={{
          marginTop: "0px",
          marginBottom: "20px",
          color: "#868686",
          fontSize: "13px",
        }}
      >
        <b>
          Please include all relevant IDs, message links or any audiovisual
          evidence in the Description.
        </b>
        Without this specific information, instance administrators cannot take
        action on your report.
      </span>
      <div className="divider" />
      <Button
        style={{ width: "100%" }}
        onClick={() => {
          setIsSubmitReportModalOpen(true);
        }}
        variant="danger"
      >
        Submit Report
      </Button>
      <SubmitReport
        isOpen={isSubmitReportModalOpen}
        onClose={() => {
          setIsSubmitReportModalOpen(false);
        }}
        onConfirm={async () => {
          await handleSubmitReport();
          setIsSubmitReportModalOpen(false);
        }}
      />
    </>
  );
}
