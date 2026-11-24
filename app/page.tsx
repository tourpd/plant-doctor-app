// 첫 화면은 새 버전(포토닥터 농사일지)이다.
// 예전 진단 화면은 그대로 /ai 에 있고, 새 화면의 "작물이 이상해요" 버튼으로 들어간다.
import PhotoDoctorV2 from "./v2/page";

export default function Page() {
  return <PhotoDoctorV2 />;
}
