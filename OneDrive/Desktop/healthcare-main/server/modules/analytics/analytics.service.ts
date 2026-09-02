import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class AnalyticsService {
  private client: AxiosInstance;

  constructor() {
    const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';
    this.client = axios.create({
      baseURL: pythonServiceUrl,
      timeout: 10000,
    });
  }

  async getFacilityDashboard(facilityId: number) {
    try {
      const response = await this.client.get(`/api/analytics/facility/${facilityId}/dashboard`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch facility dashboard: ${error.message}`);
    }
  }

  async getWaitTimes(facilityId: number, hours: number = 24) {
    try {
      const response = await this.client.get(`/api/analytics/facility/${facilityId}/wait-times`, {
        params: { hours },
      });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch wait times: ${error.message}`);
    }
  }

  async getDailyReport(facilityId: number, date?: string) {
    try {
      const params = date ? { date } : {};
      const response = await this.client.get(`/api/reports/facility/${facilityId}/daily`, { params });
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch daily report: ${error.message}`);
    }
  }

  async getWeeklyReport(facilityId: number) {
    try {
      const response = await this.client.get(`/api/reports/facility/${facilityId}/weekly`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch weekly report: ${error.message}`);
    }
  }

  async getMonthlyReport(facilityId: number) {
    try {
      const response = await this.client.get(`/api/reports/facility/${facilityId}/monthly`);
      return response.data;
    } catch (error) {
      throw new Error(`Failed to fetch monthly report: ${error.message}`);
    }
  }

  async pythonServiceHealthCheck() {
    try {
      const response = await this.client.get('/api/health');
      return response.data;
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }
}
