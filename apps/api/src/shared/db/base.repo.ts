import type {
  Model,
  ModelStatic,
  FindOptions,
  CreateOptions,
  UpdateOptions,
  DestroyOptions,
  WhereOptions,
} from 'sequelize';

export class BaseRepo<TModel extends Model> {
  constructor(protected readonly model: ModelStatic<TModel>) {}

  findById(id: string, options?: Omit<FindOptions, 'where'>) {
    return this.model.findByPk(id, options);
  }

  findOne(where: WhereOptions, options?: Omit<FindOptions, 'where'>) {
    return this.model.findOne({ ...options, where });
  }

  findAll(where?: WhereOptions, options?: Omit<FindOptions, 'where'>) {
    return this.model.findAll({ ...options, ...(where ? { where } : {}) });
  }

  create(values: any, options?: CreateOptions) {
    return this.model.create(values, options);
  }

  async updateById(
    id: string,
    values: any,
    options?: Omit<UpdateOptions, 'where'>,
  ) {
    const [count] = await this.model.update(values, {
      ...options,
      where: { id } as any,
    });
    return count;
  }

  async update(id: string, values: any): Promise<TModel> {
    const instance = await this.findById(id);
    if (!instance) {
      throw new Error('Record not found');
    }
    await instance.update(values);
    return instance;
  }

  async softDelete(id: string): Promise<void> {
    const instance = await this.findById(id);
    if (!instance) {
      throw new Error('Record not found');
    }
    await instance.destroy();
  }

  async delete(id: string): Promise<void> {
    return this.softDelete(id);
  }

  deleteById(id: string, options?: Omit<DestroyOptions, 'where'>) {
    return this.model.destroy({ ...options, where: { id } as any });
  }
}
