import { TestAntWrapped } from "../common/TestAntWrapped";
import { CheckBox } from "ksnm-common-ui/lib/CheckBox";

const TestFeedbackPage = () => {
  return (
    <div>
      <TestAntWrapped title="testfeedback.wrapped.ant" />
      <CheckBox label="testfeedback.ksnm-common-ui.checkbox" />
    </div>
  );
};

export default TestFeedbackPage;
