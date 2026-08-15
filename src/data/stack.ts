/* Ported from pages/tech-stack/tech-stack.html, including the data-group
   values that drive the relatedness highlighting. That interaction was the
   one genuinely good idea in the old site and it survives the redesign. */

export interface StackItem {
  name: string;
  sub: string;
  groups: string[];
}

export interface StackSection {
  title: string;
  items: StackItem[];
}

const g = (s: string) => s.split(' ');

export const stack: StackSection[] = [
  {
    title: 'Languages',
    items: [
      { name: 'Java', sub: 'Proficient', groups: g('proficient systems backend') },
      { name: 'Python', sub: 'Proficient', groups: g('proficient data ml backend') },
      { name: 'C++', sub: 'Proficient', groups: g('proficient systems') },
      { name: 'TypeScript', sub: 'Proficient', groups: g('proficient web') },
      { name: 'JavaScript', sub: 'Familiar', groups: g('familiar web') },
      { name: 'PHP', sub: 'Familiar', groups: g('familiar web') },
      { name: 'R', sub: 'Familiar', groups: g('familiar data') },
      { name: 'HTML & CSS', sub: 'Familiar', groups: g('familiar web') },
      { name: 'C#', sub: 'Familiar', groups: g('familiar systems game') },
      { name: 'MATLAB', sub: 'Familiar', groups: g('familiar data') },
    ],
  },
  {
    title: 'Cloud & AWS',
    items: [
      { name: 'AWS CDK', sub: 'IaC', groups: g('aws cloud iac devops') },
      { name: 'DynamoDB', sub: 'Database', groups: g('aws cloud') },
      { name: 'S3', sub: 'Storage', groups: g('aws cloud') },
      { name: 'SNS & SQS', sub: 'Messaging', groups: g('aws cloud messaging') },
      { name: 'EC2', sub: 'Compute', groups: g('aws cloud') },
      { name: 'Lambda', sub: 'Serverless', groups: g('aws cloud') },
      { name: 'CloudWatch', sub: 'Monitoring', groups: g('aws cloud devops monitoring') },
      { name: 'IAM', sub: 'Security', groups: g('aws cloud') },
      { name: 'Bedrock', sub: 'AI Platform', groups: g('aws cloud ml llm') },
      { name: 'Docker', sub: 'Containers', groups: g('container devops systems') },
      { name: 'Kubernetes', sub: 'Orchestration', groups: g('container devops systems') },
    ],
  },
  {
    title: 'AI & ML',
    items: [
      { name: 'AWS Bedrock', sub: 'LLM Platform', groups: g('aws cloud ml llm') },
      { name: 'Generative AI', sub: 'Integration', groups: g('ml llm') },
      { name: 'Prompt Engineering', sub: 'LLM Tuning', groups: g('ml llm') },
      { name: 'PyTorch', sub: 'ML Framework', groups: g('ml data') },
      { name: 'TensorFlow', sub: 'ML Framework', groups: g('ml data') },
    ],
  },
  {
    title: 'Frameworks',
    items: [
      { name: 'Node.js', sub: 'Runtime', groups: g('web backend') },
      { name: 'React.js', sub: 'Frontend', groups: g('web') },
      { name: 'REST APIs', sub: 'API Design', groups: g('web backend') },
      { name: 'NumPy', sub: 'Data Science', groups: g('data') },
      { name: 'Pandas', sub: 'Data Science', groups: g('data') },
      { name: 'Jupyter', sub: 'Notebooks', groups: g('data ml') },
      { name: 'Unreal Engine 5', sub: 'Game Engine', groups: g('game') },
      { name: 'Unity', sub: 'Game Engine', groups: g('game') },
      { name: 'Blender', sub: '3D / Art', groups: g('game') },
      { name: 'Arduino', sub: 'Hardware', groups: g('hardware') },
      { name: 'Git & GitHub', sub: 'Version Control', groups: g('devops') },
    ],
  },
  {
    title: 'Competencies',
    items: [
      { name: 'System Design', sub: 'Architecture', groups: g('architecture systems') },
      { name: 'Distributed Systems', sub: 'Architecture', groups: g('architecture systems') },
      { name: 'Microservices', sub: 'Architecture', groups: g('architecture systems backend') },
      { name: 'Event-Driven', sub: 'Architecture', groups: g('architecture messaging') },
      { name: 'CI/CD', sub: 'DevOps', groups: g('iac devops') },
      { name: 'Data Pipelines', sub: 'Infrastructure', groups: g('devops data messaging') },
      { name: 'API Design', sub: 'Backend', groups: g('architecture backend web') },
      { name: 'Observability', sub: 'Monitoring', groups: g('devops monitoring') },
      { name: 'Cost Optimization', sub: 'Cloud', groups: g('aws cloud') },
      { name: 'Agile', sub: 'Process', groups: g('architecture') },
    ],
  },
];
