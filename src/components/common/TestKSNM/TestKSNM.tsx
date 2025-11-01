import { useState } from "react";
import { CheckBox } from "ksnm-common-ui/lib/CheckBox";

const TestKsnm = () => {
  const [a, setA] = useState();
  console.log({ a, setA });
  return <CheckBox />;
};

export default TestKsnm;
