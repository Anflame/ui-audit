import { Input } from "antd";
import { type FC, useEffect, useState } from "react";

interface TestAntWrappedProps {
  title?: string;
}

const TestAntWrapped: FC<TestAntWrappedProps> = ({ title }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  console.log({ visible });
  return <Input title={title} />;
};

export default TestAntWrapped;
