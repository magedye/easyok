import FeedbackTrainingConsole from './FeedbackTrainingConsole';
import TrainingManagement from './TrainingManagement';
import LearningValidationView from './LearningValidationView';

export default function OperationalConsole() {
  return (
    <div className="space-y-8" dir="rtl">
      <TrainingManagement />
      <FeedbackTrainingConsole />
      <LearningValidationView />
    </div>
  );
}
