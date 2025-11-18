// src/data/test-data-service.ts
import mockTestData from './mock-test-data.json';

export interface AmostraResultado {
  id: string | number;
  titulo: string;
  subtitulo: string;
  status: 'Positiva' | 'Negativa' | 'Inconclusiva';
}

export interface TestHistoryItem {
  id: string;
  testType: 'cinomose' | 'ibv_geral' | 'ibv_especifico' | 'custom';
  testLabel: string;
  timestamp: string;
  operator: string;
  animalName: string;
  animalSpecies: string;
  result: 'Positivo' | 'Negativo' | 'Inconclusivo';
  notes: string;
  // Novos campos para suportar múltiplas amostras
  amostras?: AmostraResultado[];
}

export interface Operator {
  id: string;
  name: string;
  specialty: string;
  active: boolean;
}

export interface TestType {
  key: 'cinomose' | 'ibv_geral' | 'ibv_especifico';
  label: string;
  description: string;
  species: string[];
  duration: string;
}

export interface TestStatistics {
  totalTests: number;
  positiveResults: number;
  negativeResults: number;
  mostCommonTest: string;
  mostActiveOperator: string;
  lastTestDate: string;
}

export interface TestData {
  testHistory: TestHistoryItem[];
  operators: Operator[];
  testTypes: TestType[];
  statistics: TestStatistics;
}

class TestDataService {
  private data: TestData = mockTestData as TestData;

  /**
   * Obtém todos os testes históricos
   */
  getAllTestHistory(): TestHistoryItem[] {
    return this.data.testHistory.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  /**
   * Obtém testes por tipo
   */
  getTestsByType(
    testType: 'cinomose' | 'ibv_geral' | 'ibv_especifico'
  ): TestHistoryItem[] {
    return this.data.testHistory
      .filter(test => test.testType === testType)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Obtém testes por operador
   */
  getTestsByOperator(operatorName: string): TestHistoryItem[] {
    return this.data.testHistory
      .filter(test => test.operator === operatorName)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Obtém um teste específico por ID
   */
  getTestById(id: string): TestHistoryItem | undefined {
    return this.data.testHistory.find(test => test.id === id);
  }

  /**
   * Obtém todos os operadores
   */
  getAllOperators(): Operator[] {
    return this.data.operators.filter(op => op.active);
  }

  /**
   * Obtém todos os tipos de teste
   */
  getAllTestTypes(): TestType[] {
    return this.data.testTypes;
  }

  /**
   * Obtém estatísticas gerais
   */
  getStatistics(): TestStatistics {
    return this.data.statistics;
  }

  /**
   * Obtém testes recentes (últimos N dias)
   */
  getRecentTests(days: number = 7): TestHistoryItem[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.data.testHistory
      .filter(test => new Date(test.timestamp) >= cutoffDate)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Obtém testes por resultado
   */
  getTestsByResult(result: 'Positivo' | 'Negativo'): TestHistoryItem[] {
    return this.data.testHistory
      .filter(test => test.result === result)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
  }

  /**
   * Simula adição de novo teste (para demonstração)
   */
  addTest(test: Omit<TestHistoryItem, 'id'>): TestHistoryItem {
    const newTest: TestHistoryItem = {
      ...test,
      id: `test_${String(this.data.testHistory.length + 1).padStart(3, '0')}`,
    };

    this.data.testHistory.unshift(newTest);
    this.updateStatistics();

    return newTest;
  }

  /**
   * Atualiza estatísticas após mudanças nos dados
   */
  private updateStatistics(): void {
    const totalTests = this.data.testHistory.length;
    const positiveResults = this.data.testHistory.filter(
      t => t.result === 'Positivo'
    ).length;
    const negativeResults = totalTests - positiveResults;

    // Contar tipos de teste mais comum
    const testTypeCounts = this.data.testHistory.reduce(
      (acc, test) => {
        acc[test.testType] = (acc[test.testType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const mostCommonTest =
      Object.entries(testTypeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'cinomose';

    // Contar operador mais ativo
    const operatorCounts = this.data.testHistory.reduce(
      (acc, test) => {
        acc[test.operator] = (acc[test.operator] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const mostActiveOperator =
      Object.entries(operatorCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
      'Vet. Luíza';

    // Data do último teste
    const lastTestDate =
      this.data.testHistory.length > 0
        ? this.data.testHistory[0]?.timestamp || new Date().toISOString()
        : new Date().toISOString();

    this.data.statistics = {
      totalTests,
      positiveResults,
      negativeResults,
      mostCommonTest,
      mostActiveOperator,
      lastTestDate,
    };
  }
}

// Exportar instância singleton
export const testDataService = new TestDataService();
export default testDataService;
